import { statsService } from "@/api/stats/statsService";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import * as deepl from "deepl-node";
import type { SourceLanguageCode, TargetLanguageCode, Translator } from "deepl-node";
import { StatusCodes } from "http-status-codes";
import type mongoose from "mongoose";
import { openaiService } from "../openai/openaiService";
import { translationService } from "../translation/translationService";
import type { GenerateQuestionsDto } from "./dto/generate-questions.dto";
import type { GetQuestionFiltersDto } from "./dto/get-question-filters.dto";
import { CategoryModel } from "./models/category.model";
import { OldQuestionModel, type QuestionType } from "./models/question-old.model";
import { type ILocaleSchema, type IQuestion, QuestionModel, type QuestionStatus } from "./models/question.model";

const GENERATED_QUESTION_TTL = Number(process.env.GENERATED_QUESTION_TTL ?? 604800);

export class QuestionService {
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
        status: status && status !== "generated" ? { $eq: status } : { $ne: "generated" },
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
    } | null>
  > {
    //#region Deprecated Redis implementation
    // // Получаем все ключи вопросов
    // const questionKeys = await redisClient.keys("question:*");

    // const questionsCount = questionKeys.length;
    // const totalPages = Math.ceil(questionsCount / limit);

    // // Разбиваем на страницы
    // const slicedKeys = questionKeys.slice((page - 1) * limit, page * limit);

    // // Загружаем вопросы из Redis
    // const questionsData = await Promise.all(
    //   slicedKeys.map(async (key) => {
    //     const data = await redisClient.get(key);
    //     return data ? JSON.parse(data) : null;
    //   }),
    // );

    // // Фильтруем null (если вдруг какой-то ключ был, но данные не загрузились)
    // const questions = questionsData.filter((q) => q !== null) as IQuestion[];

    // return ServiceResponse.success<{
    //   questions: IQuestion[];
    //   questionsCount: number;
    //   totalPages: number;
    // }>("Questions found", {
    //   questions,
    //   questionsCount,
    //   totalPages,
    // });
    //#endregion

    try {
      // Проверяем корректность входных параметров
      const validLimit = !limit || limit <= 0 || Number.isNaN(Number(limit)) ? 10 : limit;
      const validPage = !page || page <= 0 || Number.isNaN(Number(page)) ? 1 : page;

      const [questions, questionsCount] = await Promise.all([
        QuestionModel.find({ status: "generated" })
          .sort({ createdAt: -1 }) // Сортировка по createdAt (новые сначала)
          .limit(validLimit)
          .skip((validPage - 1) * validLimit)
          .lean(),
        QuestionModel.countDocuments({ status: "generated" }),
      ]);

      // Рассчитываем totalPages
      const totalPages = questionsCount > 0 ? Math.ceil(questionsCount / validLimit) : 1;

      return ServiceResponse.success<{
        questions: IQuestion[];
        questionsCount: number;
        totalPages: number;
      }>("Questions found", {
        questions,
        questionsCount,
        totalPages,
      });
    } catch (error) {
      logger.error(`Error getting generated questions: ${error as Error}`);
      return ServiceResponse.failure(
        error instanceof Error ? error.message : "Failed to get generated questions",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getGeneratedQuestion(questionId: string): Promise<ServiceResponse<IQuestion | null>> {
    const question = await QuestionModel.findOne({
      _id: questionId,
      status: "generated",
    }).lean();

    if (!question) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success("Question found", question);
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

  async generateQuestions(generateQuestionsDto: GenerateQuestionsDto): Promise<
    ServiceResponse<{
      questions: IQuestion[];
      totalTokensUsed: number;
      completionTokensUsed: number;
    } | null>
  > {
    try {
      const { category: categoryId, prompt, requiredLanguages } = generateQuestionsDto;
      const { questions, totalTokensUsed, completionTokensUsed } =
        // await openaiService.generateQuestionsV2(generateQuestionsDto);
        await openaiService.generateQuestionsV3(generateQuestionsDto);

      const questionsIds: string[] = questions.map((question) => question.id);
      // questions.forEach(async (question) => {
      //   question.requiredLanguages = requiredLanguages;
      //   question.categoryId = categoryId;
      //   question.createdAt = new Date();
      //   question.updatedAt = new Date();
      //   await redisClient.set(`question:${question.id}`, JSON.stringify(question), { EX: GENERATED_QUESTION_TTL });
      // });

      await QuestionModel.bulkSave(questions.map((q) => new QuestionModel(q)));

      await statsService.logQuestionGeneration(categoryId, questionsIds, totalTokensUsed, prompt);

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

  async parseQuestions(
    categoryId: number,
    boilerplateText: string,
    language: string,
    type: QuestionType,
  ): Promise<
    ServiceResponse<{
      questions: IQuestion[];
      totalTokensUsed: number;
      completionTokensUsed: number;
    } | null>
  > {
    try {
      const { questions, totalTokensUsed, completionTokensUsed } = await openaiService.parseQuestions(
        categoryId,
        boilerplateText,
        language,
        type,
      );

      const questionsIds: string[] = questions.map((question) => question.id);
      questions.forEach(async (question) => {
        question.requiredLanguages = [language];
        question.categoryId = categoryId;
        question.createdAt = new Date();
        question.updatedAt = new Date();
        await redisClient.set(`question:${question.id}`, JSON.stringify(question), { EX: GENERATED_QUESTION_TTL });
      });

      await statsService.logQuestionGeneration(categoryId, questionsIds, totalTokensUsed, boilerplateText);

      return ServiceResponse.success<{
        questions: any[];
        totalTokensUsed: number;
        completionTokensUsed: number;
      }>("Questions parsed", {
        questions,
        totalTokensUsed,
        completionTokensUsed,
      });
    } catch (error) {
      logger.error(`Error parsing questions: ${error as Error}`);
      return ServiceResponse.failure(
        error instanceof Error ? error.message : "Failed to parse questions",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
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

  // async rejectGeneratedQuestions(questionIds: string[]) {
  //   try {
  //     const redisKeys = questionIds.map((id) => `question:${id}`);
  //     const questionsData = await redisClient.mGet(redisKeys); // Получаем все вопросы одним запросом

  //     // Фильтруем отсутствующие вопросы и парсим JSON
  //     const validQuestions = questionsData
  //       .map((data, index) => (data ? { id: questionIds[index], ...JSON.parse(data) } : null))
  //       .filter((q) => q !== null) as Array<{ id: string }>;

  //     if (validQuestions.length === 0) {
  //       return ServiceResponse.failure("No valid questions found", null, StatusCodes.NOT_FOUND);
  //     }

  //     // Удаляем отклоненные вопросы из Redis
  //     await redisClient.del(redisKeys);

  //     return ServiceResponse.success<IQuestion[]>(
  //       "Questions rejected",
  //       validQuestions.map((q) => q as IQuestion),
  //     );
  //   } catch (error) {
  //     console.error("Error rejecting questions:", error);
  //     return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
  //   }
  // }

  async rejectGeneratedQuestions(questionIds: string[]) {
    try {
      // Удаляем только те вопросы, которые находятся в статусе "generated"
      const deleteResult = await QuestionModel.deleteMany({
        _id: { $in: questionIds },
        status: "generated",
      });

      if (deleteResult.deletedCount === 0) {
        return ServiceResponse.failure("No generated questions found to delete", null, StatusCodes.NOT_FOUND);
      }

      return ServiceResponse.success("Generated questions rejected and deleted", {
        deletedCount: deleteResult.deletedCount,
      });
    } catch (error) {
      console.error("Error rejecting questions:", error);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async rejectGeneratedQuestion(questionId: string) {
    try {
      const result = await this.rejectGeneratedQuestions([questionId]);
      return result.success
        ? ServiceResponse.success<{
            deletedCount: number;
          }>("Question rejected", { deletedCount: result.responseObject?.deletedCount ?? 0 })
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

  // async confirmGeneratedQuestions(questionIds: string[]) {
  //   try {
  //     const redisKeys = questionIds.map((id) => `question:${id}`);
  //     const questionsData = await redisClient.mGet(redisKeys); // Fetch all questions from Redis

  //     // Filter out missing questions and parse JSON
  //     const validQuestions = questionsData
  //       .map((data, index) => (data ? { id: questionIds[index], ...JSON.parse(data) } : null))
  //       .filter((q) => q !== null) as Array<{ id: string; categoryId: string; requiredLanguages: string[] }>;

  //     if (validQuestions.length === 0) {
  //       return ServiceResponse.failure("No valid questions found", null, StatusCodes.NOT_FOUND);
  //     }

  //     // Save questions to the database
  //     const savedQuestions = await QuestionModel.insertMany(validQuestions);

  //     // Remove confirmed questions from Redis
  //     await redisClient.del(redisKeys);

  //     // Update question status to "approved"
  //     await QuestionModel.updateMany({ _id: { $in: savedQuestions.map((q) => q._id) } }, { status: "generated" });

  //     // List of target languages for translation
  //     const requiredLocales = ["ru", "uk", "en-US", "es", "fr", "de", "it", "pl", "tr"];

  //     // Perform translation for each question
  //     const translationPromises = savedQuestions.flatMap((question) =>
  //       requiredLocales.map(async (language) => {
  //         const translationResponse = await translationService.translateQuestion(
  //           question.toJSON()._id.toString(),
  //           language as TargetLanguageCode,
  //         );

  //         if (translationResponse.success && translationResponse.responseObject) {
  //           await QuestionModel.updateOne(
  //             { _id: question._id, "locales.language": language },
  //             {
  //               $set: { "locales.$": translationResponse.responseObject }, // Update existing locale
  //             },
  //           ).then((updateResult) => {
  //             if (updateResult.matchedCount === 0) {
  //               // If no matching locale was found, add it as a new one
  //               return QuestionModel.updateOne(
  //                 { _id: question._id },
  //                 { $push: { locales: translationResponse.responseObject } },
  //               );
  //             }
  //           });
  //         }
  //       }),
  //     );

  //     await Promise.all(translationPromises);

  //     return ServiceResponse.success<IQuestion[]>(
  //       "Questions confirmed and translated",
  //       savedQuestions.map((q) => q.toJSON()),
  //     );
  //   } catch (error) {
  //     console.error("Error confirming questions:", error);
  //     return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
  //   }
  // }

  async confirmGeneratedQuestions(questionIds: string[]) {
    try {
      // Получаем вопросы из MongoDB, у которых статус "generated"
      const generatedQuestions = await QuestionModel.find({
        _id: { $in: questionIds },
        status: "generated",
      });

      if (!generatedQuestions.length) {
        return ServiceResponse.failure("No generated questions found", null, StatusCodes.NOT_FOUND);
      }

      // Обновляем статус вопросов на "in_progress"
      await QuestionModel.updateMany(
        { _id: { $in: questionIds } },
        { $set: { status: "in_progress", updatedAt: new Date() } },
      );

      // Языки, на которые нужно выполнить перевод
      const requiredLocales = ["ru", "uk", "en-US", "es", "fr", "de", "it", "pl", "tr"];

      // Переводим вопросы
      const translationPromises = generatedQuestions.flatMap((question) =>
        requiredLocales.map(async (language) => {
          const translationResponse = await translationService.translateQuestion(
            question._id!.toString(),
            language as TargetLanguageCode,
          );

          if (translationResponse.success && translationResponse.responseObject) {
            await QuestionModel.updateOne(
              { _id: question._id, "locales.language": language },
              {
                $set: { "locales.$": translationResponse.responseObject },
              },
            ).then((updateResult) => {
              if (updateResult.matchedCount === 0) {
                return QuestionModel.updateOne(
                  { _id: question._id },
                  { $push: { locales: translationResponse.responseObject } },
                );
              }
            });
          }
        }),
      );

      await Promise.all(translationPromises);

      const updatedQuestions = await QuestionModel.find({ _id: { $in: questionIds } });

      return ServiceResponse.success<IQuestion[]>(
        "Questions confirmed and translated",
        updatedQuestions.map((q) => q.toJSON()),
      );
    } catch (error) {
      console.error("Error confirming questions:", error);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async confirmGeneratedQuestion(questionId: string) {
    try {
      const result = await this.confirmGeneratedQuestions([questionId]);
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
    const updated = await QuestionModel.findOneAndUpdate(
      { _id: questionId, status: "generated" },
      {
        ...question,
        updatedAt: new Date(),
      },
      { new: true },
    ).lean();

    if (!updated) {
      return ServiceResponse.failure("Question not found or not in 'generated' status", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>("Question updated", updated);
  }

  async confirmQuestion(questionId: string) {
    try {
      const question = await QuestionModel.findById(questionId);

      if (!question) {
        return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
      }

      let mainDbId = question.mainDbId;

      const rawQuestion = question.toObject();

      rawQuestion.status = "in_progress" as QuestionStatus;
      rawQuestion.track = "general";
      // rawQuestion.type = QuestionType.Choice;

      const ukrainianLocale = rawQuestion.locales.find((locale) => locale.language === "uk");
      rawQuestion.locales = rawQuestion.locales.filter(
        (locale) => locale.language !== "uk" && locale.language !== "en-US",
      );
      ukrainianLocale!.language = "ua";

      rawQuestion.locales.push(ukrainianLocale!);
      rawQuestion.requiredLanguages = rawQuestion.locales.map((locale) => locale.language);

      // Удаляем _id только если создаем новый документ, иначе используем старый mainDbId
      if (!mainDbId) {
        const biggestId = await OldQuestionModel.findOne().sort({ _id: -1 });
        mainDbId = biggestId ? biggestId._id + 1 : 1;

        await new OldQuestionModel({
          ...rawQuestion,
          _id: mainDbId, // Устанавливаем корректный _id
        }).save();

        question.mainDbId = mainDbId;
        await question.save();
      } else {
        const oldQuestion = await OldQuestionModel.findById(mainDbId);

        if (!oldQuestion) {
          await new OldQuestionModel({
            ...rawQuestion,
            _id: mainDbId, // Используем существующий mainDbId
          }).save();
        } else {
          rawQuestion._id = mainDbId;
          await oldQuestion.updateOne(rawQuestion);
        }
      }

      logger.info(`Question confirmed: ${questionId} -> ${mainDbId}`);

      return ServiceResponse.success<IQuestion>("Question confirmed", question);
    } catch (error) {
      logger.error(`Error confirming question: ${error as Error}`);
      return ServiceResponse.failure(
        error instanceof Error ? error.message : "Failed to confirm question",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async rejectQuestion(questionId: string) {
    const deletedQuestion = await QuestionModel.findByIdAndDelete(questionId);

    if (!deletedQuestion) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion>("Question rejected", deletedQuestion);
  }

  async validateTranslationBase(
    questionData: IQuestion | null,
    // questionId: string,
    originalLanguage: string,
    targetLanguage: string,
  ): Promise<
    ServiceResponse<{
      isValid: boolean;
      suggestions: Partial<ILocaleSchema>[] | null;
      totalTokensUsed: number;
      completionTokensUsed: number;
    } | null>
  > {
    if (!questionData) {
      return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    }

    const originalLocaleOrFirst =
      questionData.locales.find((locale) => locale.language === originalLanguage) || questionData.locales[0];

    const translationLocale = questionData.locales.find((locale) => locale.language === targetLanguage);

    if (!translationLocale) {
      return ServiceResponse.failure("Translation not found", null, StatusCodes.NOT_FOUND);
    }

    const { isValid, suggestions, totalTokensUsed, completionTokensUsed } =
      await openaiService.validateQuestionTranslation(originalLocaleOrFirst, translationLocale);

    return ServiceResponse.success("Translation validated", {
      isValid,
      suggestions,
      totalTokensUsed,
      completionTokensUsed,
    });
  }

  async validateTranslation(questionId: string, originalLanguage: string, targetLanguage: string) {
    try {
      const question = await QuestionModel.findById(questionId);
      return this.validateTranslationBase(question?.toObject() ?? null, originalLanguage, targetLanguage);
    } catch (error) {
      logger.error(`Error validating translation: ${error as Error}`);
      return ServiceResponse.failure(
        error instanceof Error ? error.message : "Failed to validate translation",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateGeneratedTranslation(questionId: string, originalLanguage: string, targetLanguage: string) {
    try {
      const question = await redisClient.get(`question:${questionId}`);
      const parsedQuestion = question ? (JSON.parse(question) as IQuestion) : null;
      return this.validateTranslationBase(parsedQuestion, originalLanguage, targetLanguage);
    } catch (error) {
      logger.error(`Error validating translation: ${error as Error}`);
      return ServiceResponse.failure(
        error instanceof Error ? error.message : "Failed to validate translation",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

export const questionService = new QuestionService();
