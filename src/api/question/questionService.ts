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
import type { GetQuestionFiltersDto } from "./dto/get-question-filters.dto";
import { CategoryModel } from "./models/category.model";
import { type ILocaleSchema, type IQuestion, QuestionModel, type QuestionStatus } from "./models/question.model";

const depplAuthKey = process.env.DEEPL_AUTH_KEY!;

export type translatedQuestionResponse = {
  question: string;
  correct: string;
  wrong: string[];
  billedCharacters: number;
};

export class QuestionService {
  deeplClient: Translator = new deepl.Translator(depplAuthKey);

  async getQuestions(getQuestionFiltersDto: GetQuestionFiltersDto): Promise<
    ServiceResponse<{
      questions: IQuestion[];
      questionsCount: number;
      totalPages: number;
    }>
  > {
    const { limit, page, difficulty, type, title, status } = getQuestionFiltersDto;

    // Проверяем корректность входных параметров
    const validLimit = !limit || limit <= 0 || Number.isNaN(Number(limit)) ? 10 : limit;
    const validPage = !page || page <= 0 || Number.isNaN(Number(page)) ? 1 : page;

    // Запросы выполняются параллельно для оптимизации
    const [questions, questionsCount] = await Promise.all([
      QuestionModel.find({
        locales: { $elemMatch: { question: { $regex: title || "", $options: "i" } } },
        difficulty: difficulty ? { $eq: difficulty } : { $exists: true },
        type: type ? { $eq: type } : { $exists: true },
        status: status ? { $eq: status } : { $exists: true },
      })
        .sort({ createdAt: -1 }) // Сортировка по createdAt (новые сначала)
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

  // async getGeneratedQuestions( limit: number, page: number) {
  //   const session = await redisClient.get(`session:${sessionId}`);
  //   const sessionData = JSON.parse(session!);

  //   const questions = sessionData.questions.slice((page - 1) * limit, page * limit);

  //   const questionsCount = sessionData.questions.length;
  //   const totalPages = Math.ceil(questionsCount / limit);

  //   return ServiceResponse.success<{
  //     questions: any[];
  //     questionsCount: number;
  //     totalPages: number;
  //   }>("Questions found", {
  //     questions,
  //     questionsCount,
  //     totalPages,
  //   });
  // }

  async getGeneratedQuestions(
    limit: number,
    page: number,
  ): Promise<
    ServiceResponse<{
      questions: IQuestion[];
      questionsCount: number;
      totalPages: number;
    }>
  > {
    // Получаем все ключи вопросов
    const questionKeys = await redisClient.keys("question:*");

    const questionsCount = questionKeys.length;
    const totalPages = Math.ceil(questionsCount / limit);

    // Разбиваем на страницы
    const slicedKeys = questionKeys.slice((page - 1) * limit, page * limit);

    // Загружаем вопросы из Redis
    const questionsData = await Promise.all(
      slicedKeys.map(async (key) => {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      }),
    );

    // Фильтруем null (если вдруг какой-то ключ был, но данные не загрузились)
    const questions = questionsData.filter((q) => q !== null) as IQuestion[];

    return ServiceResponse.success<{
      questions: IQuestion[];
      questionsCount: number;
      totalPages: number;
    }>("Questions found", {
      questions,
      questionsCount,
      totalPages,
    });
  }

  async getGeneratedQuestion(questionId: string): Promise<ServiceResponse<IQuestion | null>> {
    const question = await redisClient.get(`question:${questionId}`);

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success("Question found", JSON.parse(question));
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
    // sessionId: string,
    generateQuestionsDto: GenerateQuestionsDto,
  ): Promise<
    ServiceResponse<{
      questions: IQuestion[];
      totalTokensUsed: number;
      completionTokensUsed: number;
    } | null>
  > {
    try {
      const { category, prompt, requiredLanguages } = generateQuestionsDto;
      const { questions, totalTokensUsed, completionTokensUsed } =
        await openaiService.generateQuestionsV2(generateQuestionsDto);

      // if (requiredLanguages.length > 1) {
      //   const neededLanguages = requiredLanguages.filter(
      //     (language) => !questions[0].locales.some((locale) => locale.language === language),
      //   );

      //   for (const language of neededLanguages) {
      //     await Promise.all(
      //       questions.map(async (question) => {
      //         const translatedQuestion = await this.deeplClient.translateText(
      //           question.locales[0].question,
      //           null,
      //           language as TargetLanguageCode,
      //         );

      //         const translatedAnswers = await Promise.all([
      //           ...question.locales[0].wrong.map((answer) =>
      //             this.deeplClient.translateText(answer, null, language as TargetLanguageCode),
      //           ),
      //           this.deeplClient.translateText(question.locales[0].correct, null, language as TargetLanguageCode),
      //         ]);

      //         const newLocale = {
      //           language,
      //           question: translatedQuestion.text,
      //           correct: translatedAnswers.pop()!.text,
      //           wrong: translatedAnswers.map((answer) => answer.text),
      //           isValid: false,
      //         };

      //         question.locales.push(newLocale);
      //       }),
      //     );
      //   }
      // }

      const categoryModel = await this.findOrCreateCategory(category);
      const categoryModelId = categoryModel._id as mongoose.Types.ObjectId;

      // const session = await redisClient.get(`session:${sessionId}`);
      // const sessionData = JSON.parse(session!);
      // sessionData.questions.push(...questions);
      // await redisClient.set(`session:${sessionId}`, JSON.stringify(sessionData), { EX: 86400 });

      const questionsIds: string[] = questions.map((question) => question.id);
      questions.forEach(async (question) => {
        question.requiredLanguages = requiredLanguages;
        question.categoryId = categoryModelId;
        question.createdAt = new Date();
        question.updatedAt = new Date();
        await redisClient.set(`question:${question.id}`, JSON.stringify(question), { EX: 86400 });
      });

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
  async translateQuestionBase(
    getQuestion: () => Promise<any>,
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
    const question = await getQuestion();

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    const firstLocale: ILocaleSchema = question.locales[0];

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

    const logDeepLUsagePromises = [
      statsService.logDeepLUsage(
        questionId,
        translatedQuestion.billedCharacters,
        firstLocale.language,
        language,
        firstLocale.question,
      ),
      ...translatedAnswers.map((answer) =>
        statsService.logDeepLUsage(questionId, answer.billedCharacters, firstLocale.language, language, answer.text),
      ),
    ];

    await Promise.all(logDeepLUsagePromises);

    return ServiceResponse.success<translatedQuestionResponse>("Question translated", {
      question: translatedQuestion.text,
      correct: newLocale.correct,
      wrong: newLocale.wrong,
      billedCharacters:
        translatedQuestion.billedCharacters +
        translatedAnswers.reduce((acc, answer) => acc + answer.billedCharacters, 0),
    });
  }

  async translateQuestion(
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
    return this.translateQuestionBase(() => QuestionModel.findById(questionId).lean(), questionId, language);
  }

  async translateGeneratedQuestion(
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
    return this.translateQuestionBase(
      async () => {
        const question = await redisClient.get(`question:${questionId}`);
        return question ? JSON.parse(question) : null;
      },
      questionId,
      language,
    );
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

  async approveQuestion(questionId: string) {
    return this.updateQuestionValidationStatus(questionId, true);
  }

  async rejectQuestions(questionIds: string[]) {
    try {
      const redisKeys = questionIds.map((id) => `question:${id}`);
      const questionsData = await redisClient.mGet(redisKeys); // Получаем все вопросы одним запросом

      // Фильтруем отсутствующие вопросы и парсим JSON
      const validQuestions = questionsData
        .map((data, index) => (data ? { id: questionIds[index], ...JSON.parse(data) } : null))
        .filter((q) => q !== null) as Array<{ id: string }>;

      if (validQuestions.length === 0) {
        return ServiceResponse.failure("No valid questions found", null, StatusCodes.NOT_FOUND);
      }

      // Удаляем отклоненные вопросы из Redis
      await redisClient.del(redisKeys);

      return ServiceResponse.success<IQuestion[]>(
        "Questions rejected",
        validQuestions.map((q) => q as IQuestion),
      );
    } catch (error) {
      console.error("Error rejecting questions:", error);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async rejectQuestion(questionId: string) {
    try {
      const result = await this.rejectQuestions([questionId]);
      return result.success
        ? ServiceResponse.success<IQuestion>("Question rejected", result.responseObject![0])
        : ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    } catch (error) {
      console.error("Error rejecting question:", error);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
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

  async confirmQuestions(questionIds: string[]) {
    try {
      const redisKeys = questionIds.map((id) => `question:${id}`);
      const questionsData = await redisClient.mGet(redisKeys); // Получаем все вопросы одним запросом

      // Фильтруем отсутствующие вопросы и парсим JSON
      const validQuestions = questionsData
        .map((data, index) => (data ? { id: questionIds[index], ...JSON.parse(data) } : null))
        .filter((q) => q !== null) as Array<{ id: string; categoryId: string }>;

      if (validQuestions.length === 0) {
        return ServiceResponse.failure("No valid questions found", null, StatusCodes.NOT_FOUND);
      }

      // Обрабатываем категории
      const categoryMap = new Map<string, mongoose.Types.ObjectId>();
      for (const question of validQuestions) {
        if (!categoryMap.has(question.categoryId)) {
          const categoryModel = await this.findOrCreateCategory(question.categoryId);
          categoryMap.set(question.categoryId, categoryModel._id as mongoose.Types.ObjectId);
        }
      }

      // Создаем вопросы в базе данных
      const savedQuestions = await QuestionModel.insertMany(
        validQuestions.map((q) => ({
          ...q,
          categoryId: categoryMap.get(q.categoryId),
        })),
      );

      // Удаляем подтвержденные вопросы из Redis
      await redisClient.del(redisKeys);

      return ServiceResponse.success<IQuestion[]>(
        "Questions confirmed",
        savedQuestions.map((q) => q.toObject()),
      );
    } catch (error) {
      console.error("Error confirming questions:", error);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async confirmQuestion(questionId: string) {
    try {
      const result = await this.confirmQuestions([questionId]);
      return result.success
        ? ServiceResponse.success<IQuestion>("Question confirmed", result.responseObject![0])
        : ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    } catch (error) {
      console.error("Error confirming question:", error);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async updateQuestion(questionId: string, question: IQuestion) {
    const updatedQuestion = await QuestionModel.findByIdAndUpdate(questionId, question, { new: true });

    if (!updatedQuestion) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>("Question updated", updatedQuestion);
  }

  async updateGeneratedQuestion(questionId: string, question: IQuestion) {
    const updatedQuestion = await redisClient.set(`question:${questionId}`, JSON.stringify(question), {
      EX: 86400,
    });

    if (!updatedQuestion) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>("Question updated", question);
  }
}

export const questionService = new QuestionService();
