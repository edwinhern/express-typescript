import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import OpenAI from "openai";
// import { questionService } from "../question/questionService";
import { v4 as uuidv4 } from "uuid";
import type { GenerateQuestionsOpenAIDto } from "../question/dto/generate-questions-openai.dto";
import type { GenerateQuestionsDto } from "../question/dto/generate-questions.dto";
import { CategoryModel } from "../question/models/category.model";
import type { ILocaleSchema, IQuestion, QuestionType } from "../question/models/question.model";

export class OpenAiService {
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateQuestionsV2(
    generateQuestionsDto: GenerateQuestionsDto,
  ): Promise<{ questions: IQuestion[]; totalTokensUsed: number; completionTokensUsed: number }> {
    try {
      const {
        category: categoryId,
        type,
        requiredLanguages: [locale],
      } = generateQuestionsDto;

      const category = await CategoryModel.findById(categoryId).lean();

      // 1️⃣ Build the prompt based on the question type
      const prompt = this.buildPrompt({
        ...generateQuestionsDto,
        category: category?.name || "",
      });

      // 2️⃣ Send a request to OpenAI
      const response = await this.fetchOpenAIResponse(prompt, generateQuestionsDto);

      // 3️⃣ Parse OpenAI's response and return structured questions
      const parsedQuestions = this.parseOpenAIResponse(response, categoryId, type, locale);

      return parsedQuestions;
    } catch (error) {
      logger.error(`Error generating questions: ${(error as Error).message}`);
      throw new Error("Failed to generate questions.");
    }
  }

  async parseQuestions(categoryId: number, boilerplateText: string, language = "en", type = "choice" as QuestionType) {
    try {
      // const category = await CategoryModel.findById(categoryId).lean();

      const response = await this.parseQuestionsWithOpenAI(boilerplateText, language, type);

      const parsedQuestions = this.parseOpenAIResponse(response, categoryId, type, language);

      return parsedQuestions;
    } catch (error) {
      logger.error(`Error parsing questions: ${(error as Error).message}`);
      throw new Error("Failed to parse questions.");
    }
  }

  /**
   * Builds a prompt dynamically based on the question type.
   */
  private buildPrompt(generateQuestionsDto: GenerateQuestionsOpenAIDto): string {
    const {
      prompt,
      count,
      category,
      type,
      requiredLanguages: [locale],
    } = generateQuestionsDto;

    let basePrompt = `Generate ${count} questions based on the prompt: "${prompt}".  
                      Each question must belong to the "${category}" category and be in "${locale}".  
                      Include reliable sources (Wikipedia, Britannica, or Google Maps).`;

    if (type === "map") {
      basePrompt += ` Each question must involve identifying a specific location on a map.
                      The correct answer should be a pair of coordinates [latitude, longitude].
                      Do not generate incorrect answers.`;
    }

    return basePrompt;
  }

  getCreateQuestionsFunctionSignature(functionName: string, type = "choice") {
    const isMap = type === "map";

    return {
      name: functionName,
      description: "Generate structured questions, including map-based questions with coordinates",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                language: {
                  type: "string",
                  description: "Language of the question",
                },
                question: {
                  type: "string",
                  description: "The question text",
                },
                correct: isMap
                  ? {
                      type: "array",
                      items: { type: "number" },
                      minItems: 2,
                      maxItems: 2,
                      description: "Latitude and longitude coordinates for the correct location",
                    }
                  : {
                      type: "string",
                      description: "The correct answer",
                    },
                wrong: isMap
                  ? undefined
                  : {
                      type: "array",
                      items: { type: "string" },
                      description: "List of incorrect answers",
                    },
                sources: {
                  type: "array",
                  items: { type: "string" },
                  description: "URLs for fact-checking (Wikipedia, Britannica, Google Maps)",
                },
              },
              required: isMap
                ? ["language", "question", "correct", "sources"]
                : ["language", "question", "correct", "wrong", "sources"],
            },
          },
        },
        required: ["questions"],
      },
    };
  }

  /**
   * Sends a request to OpenAI.
   */
  private async fetchOpenAIResponse(prompt: string, generateQuestionsDto: GenerateQuestionsDto) {
    const { model, temperature, type } = generateQuestionsDto;

    return await this.openAi.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      // functions: [
      //   {
      //     name: "create_questions",
      //     description: "Generate structured questions, including map-based questions with coordinates",
      //     parameters: {
      //       type: "object",
      //       properties: {
      //         questions: {
      //           type: "array",
      //           items: {
      //             type: "object",
      //             properties: {
      //               language: { type: "string", description: "Language of the question" },
      //               question: { type: "string", description: "The question text" },
      //               correct:
      //                 type === "map"
      //                   ? {
      //                       type: "array",
      //                       items: { type: "number" },
      //                       minItems: 2,
      //                       maxItems: 2,
      //                       description: "Latitude and longitude coordinates for the correct location",
      //                     }
      //                   : { type: "string", description: "The correct answer" },
      //               wrong:
      //                 type === "map"
      //                   ? undefined
      //                   : {
      //                       type: "array",
      //                       items: { type: "string" },
      //                       description: "List of incorrect answers",
      //                     },
      //               sources: {
      //                 type: "array",
      //                 items: { type: "string" },
      //                 description: "URLs for fact-checking (Wikipedia, Britannica, Google Maps)",
      //               },
      //             },
      //             required:
      //               type === "map"
      //                 ? ["language", "question", "correct", "sources"]
      //                 : ["language", "question", "correct", "wrong", "sources"],
      //           },
      //         },
      //       },
      //       required: ["questions"],
      //     },
      //   },
      // ],
      functions: [this.getCreateQuestionsFunctionSignature("create_questions", type)],
      function_call: { name: "create_questions" },
      temperature,
    });
  }

  async parseQuestionsWithOpenAI(boilerplateText: string, language = "en", type = "choice") {
    const response = await this.openAi.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `
            You are given a text that contains multiple-choice quiz questions. Your task is to extract structured question data based on the following logic:
            
            1. If an answer is marked as correct — using ✅, ✔️, ☑️, or labeled with words like "correct", "правильний", "верный", etc. — treat it as correct.
            2. If an answer is marked as incorrect — using ❌, ✖️, or labeled with words like "incorrect", "неправильный", etc. — treat it as incorrect.
            3. If no markers are provided, choose the correct answer based on your knowledge and context.
            
            Each question must be returned as an object with:
            - "language": set this to "${language}"
            - "question": the full question text.
            - "correct": the correct answer as a string.
            - "wrong": an array of incorrect answers. If type is "choice", always include 3 incorrect answers, even if the input text contains fewer or more.
            - "sources": an URL to support fact-checking (Wikipedia, Britannica, Google or any other reliable source).
            
            If the input text is not in ${language}, translate the questions and answers into ${language}.
            
            Return a JSON object that matches the 'create_questions' schema. Do not include anything except the JSON.
            
            Input text:
            ${boilerplateText}
          `,
        },
      ],
      functions: [this.getCreateQuestionsFunctionSignature("parse_questions", type)],
      function_call: { name: "parse_questions" },
      temperature: 0,
    });

    return response;
  }

  /**
   * Parses OpenAI's response and extracts the generated questions.
   */
  private parseOpenAIResponse(
    response: any,
    category: number,
    type: QuestionType,
    locale: string,
  ): { questions: IQuestion[]; totalTokensUsed: number; completionTokensUsed: number } {
    logger.info(`OpenAI API Response: ${JSON.stringify(response, null, 2)}`);

    if (!response.choices[0]?.message?.function_call?.arguments) {
      throw new Error("No valid function response received from OpenAI.");
    }

    const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);

    if (!functionArgs.questions || !Array.isArray(functionArgs.questions)) {
      throw new Error("Invalid function response structure.");
    }

    return {
      questions: functionArgs.questions.map((question: any) => ({
        id: uuidv4(),
        categoryId: category,
        status: "pending",
        type,
        difficulty: 3,
        requiredLanguages: [locale],
        tags: [],
        locales: [
          {
            ...question,
            isValid: false,
          },
        ],
        isValid: false,
      })),
      totalTokensUsed: response.usage?.total_tokens || 0,
      completionTokensUsed: response.usage?.completion_tokens || 0,
    };
  }

  async validateQuestionTranslation(
    originalLocale: ILocaleSchema,
    targetLocale: ILocaleSchema,
  ): Promise<{
    isValid: boolean;
    suggestions: Partial<ILocaleSchema>[]; // Может быть несколько вариантов предложений
    totalTokensUsed: number;
    completionTokensUsed: number;
  }> {
    try {
      const isMapType = Array.isArray(originalLocale.correct) && originalLocale.correct.length === 2;

      const requestPayload: any = {
        original_language: originalLocale.language,
        original_question: originalLocale.question,
        target_language: targetLocale.language,
        target_question: targetLocale.question,
      };

      if (!isMapType) {
        requestPayload.original_correct = originalLocale.correct;
        requestPayload.target_correct = targetLocale.correct;
        requestPayload.original_wrong = originalLocale.wrong;
        requestPayload.target_wrong = targetLocale.wrong;
      }

      const response = await this.openAi.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert multilingual translation validator. Your job is to determine whether a translated question is **accurate**.
            
            🟢 If the translation is **completely correct**, return **"isValid: true"**. No suggestions are needed.
            🔴 If there are **errors or better alternatives**, return **"isValid: false"** and suggest corrections.
  
            - Ensure the translation conveys the same **meaning, structure, and context**.
            - If incorrect, provide **one or more alternative translations** in "suggestions".
            - If correct, **no suggestions are needed**.
  
            **Output format:** { isValid: true/false, suggestions: [...] }`,
          },
          {
            role: "user",
            content: JSON.stringify(requestPayload),
          },
        ],
        functions: [
          {
            name: "validate_translation",
            description: "Checks translation validity and provides alternative suggestions if needed",
            parameters: {
              type: "object",
              properties: {
                isValid: { type: "boolean", description: "Is the translation fully accurate?" },
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string", description: "Suggested alternative for the question text" },
                      correct: isMapType
                        ? { type: "array", items: { type: "number" }, description: "Geolocation remains unchanged" }
                        : { type: "string", description: "Suggested correct answer" },
                      wrong: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of suggested incorrect answers (if applicable)",
                      },
                    },
                    required: isMapType ? ["question"] : ["question", "correct", "wrong"],
                  },
                },
              },
              required: ["isValid"],
            },
          },
        ],
        function_call: { name: "validate_translation" },
      });

      if (!response.choices[0]?.message?.function_call?.arguments) {
        throw new Error("No valid function response received from OpenAI.");
      }

      const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);

      if (typeof functionArgs.isValid !== "boolean") {
        throw new Error("Invalid function response structure.");
      }

      return {
        isValid: functionArgs.isValid,
        totalTokensUsed: response.usage?.total_tokens || 0,
        completionTokensUsed: response.usage?.completion_tokens || 0,
        suggestions: functionArgs.isValid
          ? [] // ✅ Если перевод правильный, возвращаем пустой массив
          : functionArgs.suggestions.map((suggestion: any) => ({
              language: targetLocale.language,
              question: suggestion.question,
              correct: suggestion.correct ?? targetLocale.correct,
              wrong: suggestion.wrong ?? targetLocale.wrong,
              isValid: false, // ❗ Так как даём предложения, перевод считается некорректным
            })),
      };
    } catch (error) {
      logger.error(`Error validating translation: ${(error as Error).message}`);
      throw new Error("Failed to validate translation.");
    }
  }
}

export const openaiService = new OpenAiService();
