import { statsService } from "@/api/stats/statsService";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import * as deepl from "deepl-node";
import type { TargetLanguageCode, Translator } from "deepl-node";
import { StatusCodes } from "http-status-codes";
import type mongoose from "mongoose";
import { openaiService } from "../openai/openaiService";
import type { GenerateQuestionsDto } from "./dto/generate-questions.dto";
import { CategoryModel } from "./models/category.model";
import { type IQuestion, QuestionModel, type Status } from "./models/question.model";

const depplAuthKey = process.env.DEEPL_AUTH_KEY!;

export type translatedQuestionResponse = {
  question: string;
  correct: string;
  wrong: string[];
  billedCharacters: number;
};

export class QuestionService {
  deeplClient: Translator = new deepl.Translator(depplAuthKey);

  async getQuestions(
    limit: number,
    page: number,
  ): Promise<
    ServiceResponse<{
      questions: IQuestion[];
      questionsCount: number;
      totalPages: number;
    }>
  > {
    // Проверяем корректность входных параметров
    const validLimit = !limit || limit <= 0 || Number.isNaN(Number(limit)) ? 10 : limit;
    const validPage = !page || page <= 0 || Number.isNaN(Number(page)) ? 1 : page;

    // Запросы выполняются параллельно для оптимизации
    const [questions, questionsCount] = await Promise.all([
      QuestionModel.find()
        .limit(validLimit)
        .skip((validPage - 1) * validLimit)
        .lean(),
      QuestionModel.countDocuments(),
    ]);

    // Рассчитываем totalPages
    const totalPages = questionsCount > 0 ? Math.ceil(questionsCount / validLimit) : 1;

    return ServiceResponse.success("Questions found", {
      questions,
      questionsCount,
      totalPages,
    });
  }

  async getQuestion(questionId: string): Promise<ServiceResponse<IQuestion | null>> {
    const question = await QuestionModel.findById(questionId).lean();

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    question.id = question._id;

    return ServiceResponse.success("Question found", question);
  }

  async getGeneratedQuestions(sessionId: string, limit: number, page: number) {
    const session = await redisClient.get(`session:${sessionId}`);
    const sessionData = JSON.parse(session!);

    const questions = sessionData.questions.slice((page - 1) * limit, page * limit);

    const questionsCount = sessionData.questions.length;
    const totalPages = Math.ceil(questionsCount / limit);

    return ServiceResponse.success<{
      questions: any[];
      questionsCount: number;
      totalPages: number;
    }>("Questions found", {
      questions,
      questionsCount,
      totalPages,
    });
  }

  async getQuestionsByCategory(category: string): Promise<ServiceResponse<IQuestion[] | null>> {
    const questions = await QuestionModel.find({ category });

    if (!questions || questions.length === 0) {
      return ServiceResponse.failure("No Questions found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion[]>("Questions found", questions);
  }

  async saveQuestions(questions: IQuestion[], categoryId: mongoose.Types.ObjectId) {
    const savedQuestions = await QuestionModel.insertMany(
      questions.map((question) => ({
        ...question,
        categoryId,
      })),
    );

    return {
      questions: savedQuestions,
    };
  }

  async findOrCreateCategory(categoryName: string) {
    let category = await CategoryModel.findOne({
      name: categoryName,
    });

    if (!category) {
      category = await CategoryModel.create({
        name: categoryName,
        locales: [
          {
            language: "en",
            name: categoryName,
          },
        ],
      });
    }

    return category;
  }

  async generateQuestions(
    sessionId: string,
    generateQuestionsDto: GenerateQuestionsDto,
  ): Promise<
    ServiceResponse<{
      questions: any[];
      totalTokensUsed: number;
      completionTokensUsed: number;
    } | null>
  > {
    try {
      const { category, prompt, requiredLanguages } = generateQuestionsDto;
      const { questions, totalTokensUsed, completionTokensUsed } =
        await openaiService.generateQuestionsV2(generateQuestionsDto);

      if (requiredLanguages.length > 1) {
        const neededLanguages = requiredLanguages.filter(
          (language) => !questions[0].locales.some((locale) => locale.language === language),
        );

        for (const language of neededLanguages) {
          await Promise.all(
            questions.map(async (question) => {
              const translatedQuestion = await this.deeplClient.translateText(
                question.locales[0].question,
                null,
                language as TargetLanguageCode,
              );

              const translatedAnswers = await Promise.all([
                ...question.locales[0].wrong.map((answer) =>
                  this.deeplClient.translateText(answer, null, language as TargetLanguageCode),
                ),
                this.deeplClient.translateText(question.locales[0].correct, null, language as TargetLanguageCode),
              ]);

              const newLocale = {
                language,
                question: translatedQuestion.text,
                correct: translatedAnswers.pop()!.text,
                wrong: translatedAnswers.map((answer) => answer.text),
                isValid: false,
              };

              question.locales.push(newLocale);
            }),
          );
        }
      }

      const categoryModel = await this.findOrCreateCategory(category);
      const categoryModelId = categoryModel._id as mongoose.Types.ObjectId;

      const session = await redisClient.get(`session:${sessionId}`);
      const sessionData = JSON.parse(session!);
      sessionData.questions.push(...questions);
      await redisClient.set(`session:${sessionId}`, JSON.stringify(sessionData), { EX: 86400 });

      const questionsIds: string[] = questions.map((question) => question.id);

      await statsService.logQuestionGeneration(categoryModelId, questionsIds, totalTokensUsed, prompt);

      return ServiceResponse.success<{
        questions: any[];
        totalTokensUsed: number;
        completionTokensUsed: number;
      }>("Questions generated", {
        questions,
        totalTokensUsed,
        completionTokensUsed,
      });
    } catch (error) {
      logger.error(`Error generating questions: ${error as Error}`);
      return ServiceResponse.failure(
        error instanceof Error ? error.message : "Failed to generate questions",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async translateQuestion(
  //   questionId: string,
  //   language: TargetLanguageCode,
  // ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
  //   // Find the question
  //   const question = await QuestionModel.findById(questionId);

  //   // Find the English locale
  //   const englLocale = question?.locales.find((locale) => locale.language === "en");

  //   // Check if the question or English locale is not found
  //   if (!question || !englLocale) {
  //     return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
  //   }

  //   // Translate the question and answers
  //   const translatedQuestion = await this.deeplClient.translateText(englLocale.question, null, language);
  //   const translatedAnswers = await Promise.all([
  //     ...englLocale.wrong.map((answer) => this.deeplClient.translateText(answer, null, language)),
  //     this.deeplClient.translateText(englLocale.correct, null, language),
  //   ]);

  //   // Create a new locale with the translated question and answers
  //   const newLocale = {
  //     language,
  //     question: translatedQuestion.text,
  //     correct: translatedAnswers.pop()!.text,
  //     wrong: translatedAnswers.map((answer) => answer.text),
  //     isValid: false,
  //   };

  //   // Update the question with the new locale
  //   if (question.locales.some((locale) => locale.language === language)) {
  //     question.locales = question.locales.map((locale) => (locale.language === language ? newLocale : locale));
  //   } else {
  //     question.locales.push(newLocale);
  //   }

  //   // Save the question
  //   await question.save();

  //   // Log the usage of DeepL for the question and answers
  //   await statsService.logDeepLUsage(
  //     question._id as mongoose.Types.ObjectId,
  //     translatedQuestion.billedCharacters,
  //     "en",
  //     language,
  //     englLocale.question,
  //   );

  //   await Promise.all(
  //     translatedAnswers.map((answer) =>
  //       statsService.logDeepLUsage(
  //         question._id as mongoose.Types.ObjectId,
  //         answer.billedCharacters,
  //         "en",
  //         language,
  //         answer.text,
  //       ),
  //     ),
  //   );

  //   // Return the translated question and answers with the billed characters
  //   return ServiceResponse.success<translatedQuestionResponse>("Question translated", {
  //     question: translatedQuestion.text,
  //     correct: newLocale.correct,
  //     wrong: newLocale.wrong,
  //     billedCharacters:
  //       translatedQuestion.billedCharacters +
  //       translatedAnswers.reduce((acc, answer) => acc + answer.billedCharacters, 0),
  //   });
  // }

  async translateQuestion(
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
    const question = await QuestionModel.findById(questionId).lean();

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    const firstLocale = question.locales[0];

    const [translatedQuestion, ...translatedAnswers] = await Promise.all([
      this.deeplClient.translateText(firstLocale.question, null, language),
      ...firstLocale.wrong.map((answer) => this.deeplClient.translateText(answer, null, language)),
      this.deeplClient.translateText(firstLocale.correct, null, language),
    ]);

    const newLocale = {
      language,
      question: translatedQuestion.text,
      correct: translatedAnswers.pop()!.text,
      wrong: translatedAnswers.map((answer) => answer.text),
      isValid: false,
    };

    //пока сохранять не будем, а просто запишем логи и вернем результат

    //тут нужно залогать использование DeepL для вопроса и ответов
    await Promise.all([
      statsService.logDeepLUsage(
        question._id as mongoose.Types.ObjectId,
        translatedQuestion.billedCharacters,
        firstLocale.language,
        language,
        firstLocale.question,
      ),
      ...translatedAnswers.map((answer) =>
        statsService.logDeepLUsage(
          question._id as mongoose.Types.ObjectId,
          answer.billedCharacters,
          firstLocale.language,
          language,
          answer.text,
        ),
      ),
    ]);

    return ServiceResponse.success<translatedQuestionResponse>("Question translated", {
      question: translatedQuestion.text,
      correct: newLocale.correct,
      wrong: newLocale.wrong,
      billedCharacters:
        translatedQuestion.billedCharacters +
        translatedAnswers.reduce((acc, answer) => acc + answer.billedCharacters, 0),
    });
  }

  async updateQuestionValidationStatus(
    questionId: string,
    isValid: boolean,
  ): Promise<ServiceResponse<IQuestion | null>> {
    const question = await QuestionModel.findByIdAndUpdate(questionId, { isValid }, { new: true });

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>(isValid ? "Question approved" : "Question rejected", question);
  }

  async updateLocaleStatus(
    questionId: string,
    language: string,
    isValid: boolean,
  ): Promise<ServiceResponse<IQuestion | null>> {
    const question = await QuestionModel.findById(questionId);

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    const locale = question.locales.find((l) => l.language === language);

    if (!locale) {
      return ServiceResponse.failure("Locale not found", null, StatusCodes.NOT_FOUND);
    }

    locale.isValid = isValid;
    await question.save();

    return ServiceResponse.success<IQuestion>(
      isValid ? "Question translation confirmed" : "Question translation rejected",
      question,
    );
  }

  async approveQuestion(questionId: string) {
    return this.updateQuestionValidationStatus(questionId, true);
  }

  async rejectQuestion(questionId: string, squestionId: string) {
    const session = await redisClient.get(`session:${squestionId}`);
    const sessionData = JSON.parse(session!);

    const questionIndex = sessionData.questions.findIndex((question: any) => question.id === questionId);

    if (questionIndex === -1) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    sessionData.questions.splice(questionIndex, 1);

    await redisClient.set(`session:${squestionId}`, JSON.stringify(sessionData), { EX: 86400 });

    return ServiceResponse.success<null>("Question rejected", null);
  }

  async approveQuestionTranslation(questionId: string, language: string) {
    return this.updateLocaleStatus(questionId, language, true);
  }

  async rejectQuestionTranslation(questionId: string, language: string) {
    return this.updateLocaleStatus(questionId, language, false);
  }

  async updateQuestionStatus(questionId: string, status: Status) {
    const question = await QuestionModel.findByIdAndUpdate(questionId, { status }, { new: true });

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>("Question status updated", question);
  }

  async deleteQuestion(questionId: string) {
    const question = await QuestionModel.findByIdAndDelete(questionId);

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>("Question deleted", question);
  }

  async deleteQuestionTranslation(questionId: string, language: string) {
    const question = await QuestionModel.findById(questionId);

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    const localeIndex = question.locales.findIndex((locale) => locale.language === language);

    if (localeIndex === -1) {
      return ServiceResponse.failure("Locale not found", null, StatusCodes.NOT_FOUND);
    }

    question.locales.splice(localeIndex, 1);

    await question.save();

    return ServiceResponse.success<IQuestion>("Question translation deleted", question);
  }

  async confirmQuestion(sessionId: string, questionId: string) {
    const session = await redisClient.get(`session:${sessionId}`);
    const sessionData = JSON.parse(session!);

    const questionIndex = sessionData.questions.findIndex((question: any) => question.id === questionId);

    if (questionIndex === -1) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    const question = sessionData.questions[questionIndex];

    const categoryModel = await this.findOrCreateCategory(question.categoryId);
    const categoryModelId = categoryModel._id as mongoose.Types.ObjectId;

    const savedQuestion = await QuestionModel.create({
      ...question,
      categoryId: categoryModelId,
    });

    sessionData.questions.splice(questionIndex, 1);
    await redisClient.set(`session:${sessionId}`, JSON.stringify(sessionData), { EX: 86400 });

    return ServiceResponse.success<IQuestion>("Question confirmed", savedQuestion);
  }

  async updateQuestion(questionId: string, question: IQuestion) {
    const updatedQuestion = await QuestionModel.findByIdAndUpdate(questionId, question, { new: true });

    if (!updatedQuestion) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>("Question updated", updatedQuestion);
  }
}

export const questionService = new QuestionService();
