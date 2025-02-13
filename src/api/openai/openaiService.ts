import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import OpenAI from "openai";
import type { IQuestion } from "../question/questionModel";
import { questionService } from "../question/questionService";

export class OpenAiService {
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  async generateQuestions(
    prompt: string,
    maxTokens: number | undefined,
    count: number,
    category: string,
  ): Promise<ServiceResponse<string[]>> {
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

      // Save the generated questions to the database
      await questionService.saveQuestions(
        functionArgs.questions.map((question: IQuestion) => ({
          ...question,
          category,
        })),
      );

      return ServiceResponse.success("Questions generated", functionArgs.questions);
    } catch (error) {
      logger.error(`Error generating questions: ${(error as Error).message}`);
      throw new Error("Failed to generate questions.");
    }
  }
}

export const openaiService = new OpenAiService();
