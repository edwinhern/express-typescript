import { statsService } from "@/api/stats/statsService";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import * as deepl from "deepl-node";
import type { TargetLanguageCode, Translator } from "deepl-node";
import { StatusCodes } from "http-status-codes";
import type mongoose from "mongoose";
import { openaiService } from "../openai/openaiService";
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

  async getQuestions(): Promise<ServiceResponse<IQuestion[]>> {
    const questions = await QuestionModel.find();

    return ServiceResponse.success<IQuestion[]>("Questions found", questions);
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
    prompt: string,
    maxTokens: number | undefined,
    count: number,
    category: string,
  ): Promise<
    ServiceResponse<{
      questions: any[];
      totalTokensUsed: number;
      completionTokensUsed: number;
    } | null>
  > {
    try {
      const { questions, totalTokensUsed, completionTokensUsed } = await openaiService.generateQuestionsV2(
        prompt,
        maxTokens,
        count,
        category,
        "one_choice",
        3,
        "en",
      );

      const categoryModel = await this.findOrCreateCategory(category);
      const categoryModelId = categoryModel._id as mongoose.Types.ObjectId;

      const savedQuestions = await this.saveQuestions(questions, categoryModelId);
      const savedQuestionsIds = savedQuestions.questions.map((question) => question._id as mongoose.Types.ObjectId);

      await statsService.logQuestionGeneration(categoryModelId, savedQuestionsIds, totalTokensUsed, prompt);

      return ServiceResponse.success<{
        questions: any[];
        totalTokensUsed: number;
        completionTokensUsed: number;
      }>("Questions generated", {
        questions: savedQuestions.questions,
        totalTokensUsed,
        completionTokensUsed,
      });
    } catch (error) {
      return ServiceResponse.failure("Failed to generate questions", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async translateQuestion(
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
    // Find the question
    const question = await QuestionModel.findById(questionId);

    // Find the English locale
    const englLocale = question?.locales.find((locale) => locale.language === "en");

    // Check if the question or English locale is not found
    if (!question || !englLocale) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    // Translate the question and answers
    const translatedQuestion = await this.deeplClient.translateText(englLocale.question, null, language);
    const translatedAnswers = await Promise.all([
      ...englLocale.wrong.map((answer) => this.deeplClient.translateText(answer, null, language)),
      this.deeplClient.translateText(englLocale.correct, null, language),
    ]);

    // Create a new locale with the translated question and answers
    const newLocale = {
      language,
      question: translatedQuestion.text,
      correct: translatedAnswers.pop()!.text,
      wrong: translatedAnswers.map((answer) => answer.text),
      isValid: false,
    };

    // Update the question with the new locale
    if (question.locales.some((locale) => locale.language === language)) {
      question.locales = question.locales.map((locale) => (locale.language === language ? newLocale : locale));
    } else {
      question.locales.push(newLocale);
    }

    // Save the question
    await question.save();

    // Log the usage of DeepL for the question and answers
    await statsService.logDeepLUsage(
      question._id as mongoose.Types.ObjectId,
      translatedQuestion.billedCharacters,
      "en",
      language,
      englLocale.question,
    );

    await Promise.all(
      translatedAnswers.map((answer) =>
        statsService.logDeepLUsage(
          question._id as mongoose.Types.ObjectId,
          answer.billedCharacters,
          "en",
          language,
          answer.text,
        ),
      ),
    );

    // Return the translated question and answers with the billed characters
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

  async confirmQuestion(questionId: string) {
    return this.updateQuestionValidationStatus(questionId, true);
  }

  async rejectQuestion(questionId: string) {
    return this.updateQuestionValidationStatus(questionId, false);
  }

  async confirmQuestionTranslation(questionId: string, language: string) {
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
}

export const questionService = new QuestionService();
