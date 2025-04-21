import { statsService } from "@/api/stats/statsService";
import { ServiceResponse } from "@/common/models/serviceResponse";
import logError from "@/common/utils/logError";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import type { TargetLanguageCode } from "deepl-node";
import { StatusCodes } from "http-status-codes";
import type mongoose from "mongoose";
import { openaiService } from "../openai/openaiService";
import { translationService } from "../translation/translationService";
import type { GenerateQuestionsDto } from "./dto/generate-questions.dto";
import type { GetQuestionFiltersDto } from "./dto/get-question-filters.dto";
import { CategoryModel } from "./models/category.model";
import { OldQuestionModel, type QuestionType } from "./models/question-old.model";
import { type ILocaleSchema, type IQuestion, QuestionModel, type QuestionStatus } from "./models/question.model";

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
      QuestionModel.countDocuments({
        locales: { $elemMatch: { question: { $regex: title || "", $options: "i" } } },
        difficulty: difficulty ? { $eq: difficulty } : { $exists: true },
        type: type ? { $eq: type } : { $exists: true },
        status: status && status !== "generated" ? { $eq: status } : { $ne: "generated" },
      }),
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
      return logError(error, "Error getting generated questions");
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
        await openaiService.generateQuestionsV3(generateQuestionsDto);

      const questionsIds: string[] = questions.map((question) => question.id);

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
      return logError(error, "Error generating questions");
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

      await QuestionModel.bulkSave(questions.map((q) => new QuestionModel(q)));

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
      return logError(error, "Error parsing questions");
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
      return logError(error, "Error rejecting questions");
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
      return logError(error, "Error rejecting question");
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
      return logError(error, "Error confirming generated questions");
    }
  }

  async confirmGeneratedQuestion(questionId: string) {
    try {
      const result = await this.confirmGeneratedQuestions([questionId]);
      return result.success
        ? ServiceResponse.success<IQuestion>("Question confirmed", result.responseObject![0])
        : ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
    } catch (error) {
      return logError(error, "Error confirming question");
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
      return logError(error, "Error confirming question");
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
      return logError(error, "Error validating translation");
    }
  }

  async validateGeneratedTranslation(questionId: string, originalLanguage: string, targetLanguage: string) {
    try {
      const question = await QuestionModel.findOne({ _id: questionId, status: "generated" });
      return this.validateTranslationBase(question, originalLanguage, targetLanguage);
    } catch (error) {
      return logError(error, "Error validating translation");
    }
  }

  async validateGeneratedQuestionCorrectness(questionId: string): Promise<
    ServiceResponse<{
      isValid: boolean;
      questionId: string;
      suggestion: {
        question: string;
        correct: string | number[];
        wrong: string[];
      };
      totalTokensUsed: number;
      completionTokensUsed: number;
    } | null>
  > {
    try {
      const question = await QuestionModel.findOne({ _id: questionId, status: "generated" });

      if (!question) {
        return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
      }

      const { isValid, suggestion, totalTokensUsed, completionTokensUsed } =
        await openaiService.validateQuestionCorrectness(question);

      return ServiceResponse.success("Question validated", {
        questionId: question._id!.toString(),
        isValid,
        suggestion,
        totalTokensUsed,
        completionTokensUsed,
      });
    } catch (error) {
      return logError(error, "Error validating question correctness");
    }
  }

  async validateGeneratedQuestionsCorrectness(questionIds: string[]): Promise<
    ServiceResponse<
      | {
          questionId: string;
          isValid: boolean;
          suggestion: {
            question: string;
            correct: string | number[];
            wrong: string[];
          };
          totalTokensUsed: number;
          completionTokensUsed: number;
        }[]
      | null
    >
  > {
    try {
      const questions = await QuestionModel.find({ _id: { $in: questionIds }, status: "generated" });
      if (!questions.length) {
        return ServiceResponse.failure("No generated questions found", null, StatusCodes.NOT_FOUND);
      }
      const results = await Promise.all(
        questions.map(async (question) => {
          const { isValid, suggestion, totalTokensUsed, completionTokensUsed } =
            await openaiService.validateQuestionCorrectness(question);
          return {
            questionId: question._id!.toString(),
            isValid,
            suggestion,
            totalTokensUsed,
            completionTokensUsed,
          };
        }),
      );
      return ServiceResponse.success("Questions validated", results);
    } catch (error) {
      return logError(error, "Error validating questions correctness");
    }
  }

  async validateQuestionCorrectness(questionId: string) {
    try {
      const question = await QuestionModel.findById(questionId);

      if (!question) {
        return ServiceResponse.failure("Question not found", null, StatusCodes.NOT_FOUND);
      }

      const { isValid, suggestion, totalTokensUsed, completionTokensUsed } =
        await openaiService.validateQuestionCorrectness(question);

      return ServiceResponse.success("Question validated", {
        isValid,
        suggestion,
        totalTokensUsed,
        completionTokensUsed,
      });
    } catch (error) {
      return logError(error, "Error validating question correctness");
    }
  }

  async validateQuestionsCorrectness(questionIds: string[]) {
    try {
      const questions = await QuestionModel.find({ _id: { $in: questionIds } });

      if (!questions.length) {
        return ServiceResponse.failure("No questions found", null, StatusCodes.NOT_FOUND);
      }

      const results = await Promise.all(
        questions.map(async (question) => {
          const { isValid, suggestion, totalTokensUsed, completionTokensUsed } =
            await openaiService.validateQuestionCorrectness(question);
          return {
            isValid,
            suggestion,
            totalTokensUsed,
            completionTokensUsed,
          };
        }),
      );

      return ServiceResponse.success("Questions validated", results);
    } catch (error) {
      return logError(error, "Error validating questions correctness");
    }
  }
  async checkForDuplicateQuestions(categoryId: string): Promise<
    ServiceResponse<{
      duplicates: string[][];
      questions: IQuestion[];
    } | null>
  > {
    try {
      const questions = await QuestionModel.find({ categoryId }).lean();

      const duplicatesMap = new Map<string, Set<string>>();

      for (const question of questions) {
        for (const locale of question.locales) {
          if (locale.language !== "en") continue;

          const normalized = locale.question.trim().toLowerCase();
          if (!duplicatesMap.has(normalized)) {
            duplicatesMap.set(normalized, new Set());
          }
          duplicatesMap.get(normalized)!.add(question._id.toString());
        }
      }

      const directGroups = Array.from(duplicatesMap.values())
        .filter((set) => set.size > 1)
        .map((set) => Array.from(set));

      const semanticDuplicates: string[][] = await openaiService.findSemanticDuplicates(questions as IQuestion[]);

      const combinedMap = new Map<string, Set<string>>();

      for (const group of directGroups) {
        const main = group[0];
        if (!combinedMap.has(main)) combinedMap.set(main, new Set());
        for (const id of group) {
          combinedMap.get(main)!.add(id);
        }
      }

      for (const group of semanticDuplicates) {
        const matchedQuestions = questions.filter((q) => group.includes(q.locales[0].question));
        const ids = matchedQuestions.map((q) => q._id.toString());

        if (ids.length > 1) {
          const main = ids[0];
          if (!combinedMap.has(main)) combinedMap.set(main, new Set());
          for (const id of ids) {
            combinedMap.get(main)!.add(id);
          }
        }
      }

      const result = Array.from(combinedMap.values())
        .map((set) => Array.from(set))
        .filter((group) => group.length > 1);

      if (!result.length) {
        return ServiceResponse.success("No duplicate questions found", {
          duplicates: [],
          questions,
        });
      }

      return ServiceResponse.success("Duplicate questions found", {
        duplicates: result,
        questions,
      });
    } catch (error) {
      return logError(error, "Error checking for duplicate questions");
    }
  }
}

export const questionService = new QuestionService();
