import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import OpenAI from "openai";
import type { Tool } from "openai/resources/responses/responses";
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
   * Builds a simplified prompt based on the question type.
   */
  private buildPrompt(generateQuestionsDto: GenerateQuestionsOpenAIDto): string {
    const {
      prompt,
      count,
      category,
      type,
      requiredLanguages: [locale],
    } = generateQuestionsDto;

    let basePrompt = `Generate ${count} unique ${type === "map" ? "map-based " : ""}questions based on: "${prompt}".  
Questions should be in "${locale}" and belong to the "${category}" category.  
Include reliable sources (Wikipedia, Britannica, Google Maps).`;

    if (type === "map") {
      basePrompt += `  
Each question must include [latitude, longitude] as the correct answer.  
No incorrect options.`;
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
        status: "generated",
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

      const isFirstRequest = previous_response_id === null;

      const input = [
        ...(!isFirstRequest
          ? []
          : [
              {
                role: "system" as const,
                content: `You are a helpful assistant that generates quiz questions based on facts. Rules: generate n questions about the topic that user provides.
              - question: "What is the largest planet in the Solar System?"
              - correct: "Jupiter"
              - wrong: ["Mars", "Venus", "Mercury"]`,
              },
              {
                role: "system" as const,
                content: `Rules:
                    1. Never duplicate questions (you can't generate the same question twice - even if the wording is different).
                    2. Make sure the questions are factually correct.
                    3. Include the sources you used to generate the questions. It can be Wikipedia, news articles, etc.
                    4. Make sure the questions are unique and interesting.`,
              },
            ]),
        {
          role: "user" as const,
          content: prompt,
        },
      ];

      const response = await this.openAi.responses.create({
        model,
        previous_response_id,
        input,
        tools: [
          {
            type: "web_search_preview",
            search_context_size: "high", //TODO: can be changed
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
                        description: "Question text (max 160 characters, cannot be longer)", //TODO: must be changable
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
                              description: "Correct answer (max 50 characters, cannot be longer)", //TODO: must be changable
                            },
                      ...(type === "map"
                        ? {}
                        : {
                            wrong: {
                              type: "array",
                              description: "List of incorrect answers (3 items)",
                              items: {
                                type: "string",
                                description: "Incorrect answer (max 50 characters, cannot be longer)", //TODO: must be changable
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
        // reasoning: {
        //   effort: "medium",
        //   // generate_summary: "detailed",
        // },
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
          source: question.source,
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

  async validateQuestionCorrectness(
    question: IQuestion,
    model = "gpt-4o",
  ): Promise<{
    isValid: boolean;
    source: string;
    suggestion: {
      question: string;
      correct: string | number[];
      wrong: string[];
    };
    totalTokensUsed: number;
    completionTokensUsed: number;
  }> {
    try {
      const isMapType = question.type === "map";

      const input = [
        {
          role: "system" as const,
          content: `You are an expert fact-checker. Your job is to determine whether a question is **factually correct**.
  🟢 If the question is **completely correct**, return **"isValid: true"**. No suggestions are needed.
  🔴 If there are **errors or better alternatives**, return **"isValid: false"** and suggest corrections.
  - Need to check the question and the correct answer for correctness.
  - You can use any sources to check the correctness of the question and the answer and provide them in the "source" field.
  - If incorrect, provide **one or more alternative answers** in "suggestion".
  - If correct, **no suggestions are needed**.`,
        },
        {
          role: "user" as const,
          content: JSON.stringify({
            question: question.locales[0].question,
            correct: isMapType ? question.locales[0].correct : question.locales[0].correct,
            // wrong: isMapType ? undefined : question.locales[0].wrong,
            ...(!isMapType
              ? {
                  wrong: question.locales[0].wrong,
                }
              : {}),
          }),
        },
      ];

      const tools: Tool[] = [
        {
          type: "web_search_preview",
          search_context_size: "high",
        },
      ];

      const response = await this.openAi.responses.create({
        model,
        input,
        tools,
        text: {
          format: {
            type: "json_schema",
            name: "validate_question_correctness",
            strict: true,
            schema: {
              type: "object",
              properties: {
                isValid: {
                  type: "boolean",
                  description: "Is the question fully accurate?",
                },
                source: {
                  type: "string",
                  description: "Link to the source (eg wikipedia, britannica, reuters or other)",
                },
                suggestion: {
                  anyOf: [
                    {
                      type: "object",
                      description:
                        "Suggested corrections or alternatives for the question if the question is incorrect.",
                      properties: {
                        question: {
                          type: "string",
                          description: "Suggested alternative for the question text",
                        },
                        correct: isMapType
                          ? {
                              type: "array",
                              items: { type: "number" },
                              description: "Geolocation remains unchanged",
                            }
                          : {
                              type: "string",
                              description: "Suggested correct answer",
                            },
                        wrong: {
                          type: "array",
                          items: { type: "string" },
                          description: "List of suggested incorrect answers (if applicable)",
                        },
                      },
                      required: isMapType ? ["question"] : ["question", "correct", "wrong"],
                      additionalProperties: false,
                    },
                    {
                      type: "null",
                      description: "No suggestion provided when the question is correct.",
                    },
                  ],
                },
              },
              required: ["isValid", "source", "suggestion"],
              additionalProperties: false,
            },
          },
        },
        temperature: 0,
        max_output_tokens: 2048,
        top_p: 1,
        store: true,
        tool_choice: "required",
      });

      const { output_text } = response;
      const parsedResponse = JSON.parse(output_text);
      const { isValid, source, suggestion } = parsedResponse;
      const { usage } = response;
      const totalTokensUsed = usage?.total_tokens || 0;
      const completionTokensUsed = usage?.output_tokens || 0;
      return {
        isValid,
        source,
        suggestion,
        totalTokensUsed,
        completionTokensUsed,
      };
    } catch (error) {
      logger.error(`Error validating question correctness: ${(error as Error).message}`);
      throw new Error("Failed to validate question correctness.");
    }
  }
  async findSemanticDuplicates(questions: IQuestion[], model = "gpt-4o"): Promise<string[][]> {
    const functionDef = {
      name: "mark_duplicates",
      description: "Find groups of semantically duplicate questions",
      parameters: {
        type: "object",
        properties: {
          duplicates: {
            type: "array",
            description: "Each array inside contains phrases that are semantically equal",
            items: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
        },
        required: ["duplicates"],
      },
    };

    const prompts = questions
      .map((q, i) => {
        const firstLocale = q.locales[0];
        return `Q${i + 1}: (${firstLocale.language}) ${firstLocale.question}`;
      })
      .join("\n");

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are a helpful assistant that groups semantically similar questions written in different ways.",
      },
      {
        role: "user",
        content: `Below is a list of questions. Some may be duplicates written in different words. Group semantically equivalent questions:\n\n${prompts}`,
      },
    ];

    const response = await this.openAi.chat.completions.create({
      model,
      messages,
      tools: [{ type: "function", function: functionDef }],
      tool_choice: { type: "function", function: { name: "mark_duplicates" } },
    });

    const functionCall = response.choices[0]?.message.tool_calls?.[0]?.function;
    if (!functionCall?.arguments) return [];

    try {
      const args = JSON.parse(functionCall.arguments) as { duplicates: string[][] };
      return args.duplicates;
    } catch (err) {
      console.error("Failed to parse function call arguments", err);
      return [];
    }
  }
}

export const openaiService = new OpenAiService();
