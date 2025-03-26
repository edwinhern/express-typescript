import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import * as deepl from "deepl-node";
import type { SourceLanguageCode, TargetLanguageCode, Translator } from "deepl-node";
import { StatusCodes } from "http-status-codes";
import { type ILocaleSchema, QuestionModel } from "../question/models/question.model";
import { statsService } from "../stats/statsService";

const depplAuthKey = process.env.DEEPL_AUTH_KEY!;

export type translatedQuestionResponse = {
  question: string;
  correct: string | [number, number];
  wrong?: string[];
  billedCharacters: number;
  language: TargetLanguageCode;
};

export class TranslationService {
  deeplClient: Translator = new deepl.Translator(depplAuthKey);

  async translateQuestionBase(
    getQuestion: () => Promise<any>,
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<translatedQuestionResponse> {
    const question = await getQuestion();

    if (!question) {
      throw new Error("Question not found");
    }

    const firstLocale: ILocaleSchema = question.locales[0];
    const sourceLanguage = firstLocale.language;

    // Перевод только вопроса, если тип "map"
    if (question.type === "map") {
      const translatedQuestion = await this.deeplClient.translateText(
        firstLocale.question,
        sourceLanguage as SourceLanguageCode,
        language,
      );

      await statsService.logDeepLUsage(
        questionId,
        translatedQuestion.billedCharacters,
        sourceLanguage,
        language,
        firstLocale.question,
        translatedQuestion.text,
      );

      return {
        question: translatedQuestion.text,
        language,
        correct: firstLocale.correct, // Координаты не переводим
        billedCharacters: translatedQuestion.billedCharacters,
      };
    }

    // Перевод вопроса, неправильных и правильного ответа
    const translations = await Promise.all([
      this.deeplClient.translateText(firstLocale.question, sourceLanguage as SourceLanguageCode, language),
      ...(firstLocale.wrong || []).map((answer) =>
        this.deeplClient.translateText(answer, sourceLanguage as SourceLanguageCode, language),
      ),
      typeof firstLocale.correct === "string"
        ? this.deeplClient.translateText(firstLocale.correct, sourceLanguage as SourceLanguageCode, language)
        : Promise.resolve({ text: firstLocale.correct.toString(), billedCharacters: 0 }),
    ]);

    const translatedQuestion = translations[0];
    const translatedCorrectAnswer = translations[translations.length - 1]; // Последний элемент - это correct
    const translatedWrongAnswers = translations.slice(1, -1); // Всё кроме первого и последнего - это wrong

    const billedCharacters = translations.reduce((acc, trans) => acc + trans.billedCharacters, 0);

    // Логируем использование DeepL
    await Promise.all([
      statsService.logDeepLUsage(
        questionId,
        translatedQuestion.billedCharacters,
        sourceLanguage,
        language,
        firstLocale.question,
        translatedQuestion.text,
      ),
      statsService.logDeepLUsage(
        questionId,
        translatedCorrectAnswer.billedCharacters,
        sourceLanguage,
        language,
        typeof firstLocale.correct === "string" ? firstLocale.correct : firstLocale.correct.toString(),
        translatedCorrectAnswer.text,
      ),
      ...translatedWrongAnswers.map((answer, index) =>
        statsService.logDeepLUsage(
          questionId,
          answer.billedCharacters,
          sourceLanguage,
          language,
          firstLocale.wrong ? firstLocale.wrong[index] : "",
          answer.text,
        ),
      ),
    ]);

    return {
      question: translatedQuestion.text,
      correct: translatedCorrectAnswer.text, // Теперь correct сохраняется правильно
      wrong: translatedWrongAnswers.map((answer) => answer.text), // wrong остаётся массивом
      language,
      billedCharacters,
    };
  }

  async translateQuestion(
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
    try {
      const result = await this.translateQuestionBase(
        () => QuestionModel.findById(questionId).lean(),
        questionId,
        language,
      );

      return ServiceResponse.success("Question translated", result);
    } catch (error) {
      return ServiceResponse.failure("Failed to translate question", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async translateGeneratedQuestion(
    questionId: string,
    language: TargetLanguageCode,
  ): Promise<ServiceResponse<translatedQuestionResponse | null>> {
    try {
      const result = await this.translateQuestionBase(
        () => QuestionModel.findById(questionId).lean(),
        questionId,
        language,
      );

      return ServiceResponse.success("Question translated successfully", result);
    } catch (error) {
      logger.error(error);
      return ServiceResponse.failure("Failed to translate question", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
}

export const translationService = new TranslationService();
