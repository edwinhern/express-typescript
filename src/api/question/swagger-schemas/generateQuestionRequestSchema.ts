import { z } from "zod";

export const generateQuestionRequestSchema = {
  body: {
    content: {
      "application/json": {
        schema: z.object({
          prompt: z.string(),
          max_tokens: z.number().optional(),
          count: z.number(),
          category: z.number(),
          // difficulty: z.number().min(1).max(5).optional(),
          temperature: z.number().min(0).max(2).optional(),
          type: z.enum(["map", "one_choice"]).optional(),
          model: z.string().default("gpt-3.5-turbo").optional(),
          requiredLanguages: z.array(
            z
              .string()
              .min(2, {
                message: "Language code must be 2 characters",
              })
              .max(2, {
                message: "Language code must be 2 characters",
              }),
          ),
        }),
        examples: {
          "One Choice (English with GPT-3.5 Turbo)": {
            value: {
              prompt: "Some history of the United States",
              // max_tokens: 500,
              count: 5,
              model: "gpt-3.5-turbo",
              category: 1,
              difficulty: 3,
              temperature: 0.7,
              type: "one_choice",
              requiredLanguages: ["en"],
            },
            description:
              "Generate 5 one choice questions about the history of the United States by using GPT-3.5 Turbo model",
          },
          "One Choice (English with GPT-4o)": {
            value: {
              prompt: "Some history of the United States",
              // max_tokens: 500,
              count: 5,
              model: "gpt-4o",
              category: 3,
              difficulty: 3,
              temperature: 1.0,
              type: "one_choice",
              requiredLanguages: ["en"],
            },
            description: "Generate 5 one choice questions about the history of the United States by using GPT-4o model",
          },
          "Multiple Choice (English with GPT-3.5 Turbo)": {
            value: {
              prompt: "Some history of the United States",
              // max_tokens: 500,
              count: 5,
              model: "gpt-3.5-turbo",
              category: 5,
              difficulty: 3,
              temperature: 1.2,
              type: "multiple_choice",
              requiredLanguages: ["en"],
            },
            description:
              "Generate 5 multiple choice questions about the history of the United States by using GPT-3.5 Turbo model",
          },
          "Multiple Choice (English with GPT-4o)": {
            value: {
              prompt: "Some history of the United States",
              // max_tokens: 500,
              count: 5,
              model: "gpt-4o",
              category: 8,
              difficulty: 3,
              temperature: 1.2,
              type: "multiple_choice",
              requiredLanguages: ["en"],
            },
          },
        },
      },
    },
  },
};
