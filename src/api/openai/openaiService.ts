import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import type { GenerateQuestionsOpenAIDto } from "../question/dto/generate-questions-openai.dto";
import type { GenerateQuestionsDto } from "../question/dto/generate-questions.dto";
import { CategoryModel } from "../question/models/category.model";
import type { ILocaleSchema, IQuestion, QuestionStatus, QuestionType } from "../question/models/question.model";

export class OpenAiService {
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async parseQuestions(categoryId: number, boilerplateText: string, language = "en", type = "choice" as QuestionType) {
    try {
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
                      Include reliable sources (Wikipedia, Britannica, or Google Maps).
                      Do not duplicate questions.`;

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

  async generateQuestionsV3(generateQuestionsDto: GenerateQuestionsDto): Promise<{
    questions: IQuestion[];
    totalTokensUsed: number;
    completionTokensUsed: number;
  }> {
    try {
      const {
        category: categoryId,
        type,
        model,
        requiredLanguages: [locale],
      } = generateQuestionsDto;

      const category = await CategoryModel.findById(categoryId).lean();

      // 1️⃣ Find in cache data about the previous request to OpenAI by category ID
      const cacheKey = `openai:response:${categoryId}`;
      const cachedResponse = await redisClient.get(cacheKey);

      let previous_response_id = null;

      if (cachedResponse) {
        const cacheObject = JSON.parse(cachedResponse);
        const { response_id, total_tokens } = cacheObject;

        if (total_tokens < 128000) {
          previous_response_id = response_id;
        } else {
          logger.info(`Category ${categoryId} has reached the token limit. Generating a new set of questions.`);
          await redisClient.del(cacheKey);
        }
      }

      // 2️⃣ Build the prompt based on the question type
      const prompt = this.buildPrompt({
        ...generateQuestionsDto,
        category: category?.name || "",
      });

      const response = await this.openAi.responses.create({
        model,
        previous_response_id,
        input: [
          ...(previous_response_id
            ? []
            : [
                {
                  role: "system" as const,
                  content: `You are a question generator. Your task is to create structured questions based on the given prompt. This is rules:
                      1. Each question must belong to the "${category?.name}" category and be in "${locale}".
                      2. Include reliable sources (Wikipedia, Britannica, or Google Maps) for each question.
                      3. Do not duplicate questions.
                      4. If the question is a map-based question, the correct answer should be a pair of coordinates [latitude, longitude].
                      5. If the question is a choice question, include 3 incorrect answers.
                      6. If the input text is not in ${locale}, translate the questions and answers into ${locale}.`,
                },
              ]),
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        tools: [
          {
            type: "web_search_preview",
            user_location: {
              type: "approximate",
              country: "UA", //TODO: Must be changable
              city: "Kyiv", //TODO: Must be changable
            },
            search_context_size: "medium", //TODO: can be changed
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "create_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  description: `A list of structured ${type === "map" ? "map-based" : "choice"} questions`,
                  items: {
                    type: "object",
                    properties: {
                      language: {
                        type: "string",
                        description: "Language of the question (en, ua or etc)",
                      },
                      question: {
                        type: "string",
                        description: "Question text",
                      },
                      correct:
                        type === "map"
                          ? {
                              type: "array",
                              items: { type: "number" },
                              // minItems: 2,
                              // maxItems: 2,
                              description: "Latitude and longitude coordinates (array of 2 numbers)",
                            }
                          : {
                              type: "string",
                              description: "Correct answer",
                            },
                      ...(type === "map"
                        ? {}
                        : {
                            wrong: {
                              type: "array",
                              description: "List of incorrect answers (3 items)",
                              items: {
                                type: "string",
                              },
                            },
                          }),
                      source: {
                        type: "string",
                        description: "Link to the source (eg wikipedia, britannica, reuters or other)",
                      },
                    },
                    required:
                      type === "map"
                        ? ["language", "question", "correct", "source"]
                        : ["language", "question", "correct", "wrong", "source"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
        reasoning: {},
        tool_choice: "required",
        temperature: 1,
        max_output_tokens: 2048,
        top_p: 1,
        store: true,
      });

      //EX must be 7 days

      // 3️⃣ Save the response ID to cache
      await redisClient.set(
        cacheKey,
        JSON.stringify({ response_id: response.id, total_tokens: response.usage?.total_tokens }),
        { EX: 604800 }, //TODO: move it to .env
      );

      const { output_text } = response;

      const parsedQuestions = JSON.parse(output_text).questions;

      return {
        questions: parsedQuestions.map((question: any) => ({
          id: uuidv4(),
          categoryId,
          status: "generated" as QuestionStatus,
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
        completionTokensUsed: response.usage?.output_tokens || 0,
      };
    } catch (error) {
      logger.error(`Error generating questions: ${(error as Error).message}`);
      const cacheKey = `openai:response:${generateQuestionsDto.category}`;
      if (await redisClient.exists(cacheKey)) {
        await redisClient.del(cacheKey);
        logger.info(`Deleted cache for category ${generateQuestionsDto.category}.`);
      }

      throw new Error("Failed to generate questions.");
    }
  }
}

export const openaiService = new OpenAiService();
