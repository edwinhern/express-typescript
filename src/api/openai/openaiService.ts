import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import OpenAI from "openai";
// import { questionService } from "../question/questionService";
import { v4 as uuidv4 } from "uuid";
import type { GenerateQuestionsDto } from "../question/dto/generate-questions.dto";
import { type ILocaleSchema, type IQuestion, QuestionType } from "../question/models/question.model";

export class OpenAiService {
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  async generateQuestionsV1(
    prompt: string,
    maxTokens: number | undefined,
    count: number,
    category: string | undefined,
  ): Promise<{
    questions: IQuestion[];
    totalTokensUsed: number;
    completionTokensUsed: number;
  }> {
    try {
      const response = await this.openAi.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: `Generate ${count} multiple-choice questions using the prompt: "${prompt}". Each question must have one correct and three incorrect answers in the "${category}" category.`,
          },
        ],
        functions: [
          {
            name: "create_questions",
            description: "Generate a list of structured multiple-choice questions",
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
                        description: "Language of the question (e.g., en)",
                      },
                      question: {
                        type: "string",
                        description: "The text of the question",
                      },
                      correct: {
                        type: "string",
                        description: "The correct answer",
                      },
                      wrong: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of incorrect answers",
                      },
                    },
                    required: ["language", "question", "correct", "wrong"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        ],
        function_call: { name: "create_questions" },
        max_tokens: maxTokens,
      });

      logger.info(`OpenAI API Response: ${JSON.stringify(response, null, 2)}`);

      // Check if the response contains the function call arguments
      if (!response.choices[0]?.message?.function_call?.arguments) {
        throw new Error("No valid function response received from OpenAI.");
      }

      const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);

      // Validate the structure of the parsed arguments
      if (!functionArgs.questions || !Array.isArray(functionArgs.questions)) {
        throw new Error("Invalid function response structure.");
      }

      return {
        questions: functionArgs.questions.map((question: ILocaleSchema) => {
          return {
            // categoryId: category,
            status: "pending",
            type: QuestionType.OneChoice,
            difficulty: 3,
            requiredLanguages: ["en"], // TODO: Discuss with the team if we need by default to have multiple languages
            tags: [],
            locales: [
              {
                ...question,
                isValid: false,
              },
            ],
            isValid: false,
          };
        }),
        totalTokensUsed: response.usage?.total_tokens || 0,
        completionTokensUsed: response.usage?.completion_tokens || 0,
      };
    } catch (error) {
      logger.error(`Error generating questions: ${(error as Error).message}`);
      throw new Error("Failed to generate questions.");
    }
  }

  async generateQuestionsV2(
    generateQuestionsDto: GenerateQuestionsDto,
  ): Promise<{ questions: IQuestion[]; totalTokensUsed: number; completionTokensUsed: number }> {
    try {
      const {
        prompt,
        max_tokens: maxTokens,
        count,
        category,
        type: questionType,
        difficulty,
        requiredLanguages: [locale],
      } = generateQuestionsDto;

      const response = await this.openAi.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: `Generate ${count} ${questionType.replace("_", " ")} questions using the prompt: "${prompt}". 
                      Each question must be in the "${category}" category, have a difficulty level of ${difficulty}, 
                      and be in the "${locale}" language.
                      
                      Additionally, provide a list of reliable sources (like Wikipedia, Britannica, or government websites) 
                      for fact-checking each question. If possible, include direct links.`,
          },
        ],
        functions: [
          {
            name: "create_questions",
            description: "Generate a list of structured multiple-choice questions with fact-checking sources",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      language: { type: "string", description: "Question language (e.g., en, de, pl)" },
                      question: { type: "string", description: "The question text" },
                      correct: {
                        type: questionType === QuestionType.TrueFalse ? "boolean" : "string",
                        description: "The correct answer(s)",
                      },
                      wrong: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of incorrect answers",
                      },
                      sources: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of URLs or references for fact-checking the question",
                      },
                    },
                    required: ["language", "question", "correct", "sources"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        ],
        function_call: { name: "create_questions" },
        max_tokens: maxTokens,
      });

      logger.info(`OpenAI API Response: ${JSON.stringify(response, null, 2)}`);

      if (!response.choices[0]?.message?.function_call?.arguments) {
        throw new Error("No valid function response received from OpenAI.");
      }

      const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);

      if (!functionArgs.questions || !Array.isArray(functionArgs.questions)) {
        throw new Error("Invalid function response structure.");
      }

      return {
        questions: functionArgs.questions.map((question: ILocaleSchema) => ({
          id: uuidv4(),
          categoryId: category,
          status: "pending",
          type: questionType,
          difficulty,
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
    } catch (error) {
      logger.error(`Error generating questions: ${(error as Error).message}`);
      throw new Error("Failed to generate questions.");
    }
  }
}

export const openaiService = new OpenAiService();
