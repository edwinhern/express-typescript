import { z } from "zod";

export const updateQuestionRequestSchema = {
  params: z.object({
    id: z.string().min(1, { message: "Question ID is required" }),
  }),
  body: {
    content: {
      "application/json": {
        schema: z.object({
          categoryId: z.string().optional(),
          status: z.string().optional(),
          track: z.string().optional(),
          type: z.string().optional(),
          difficulty: z.number().optional(),
          requiredLanguages: z.array(z.string()).optional(),
          audioId: z.string().optional(),
          imageId: z.string().optional(),
          authorId: z.string().optional(),
          tags: z.array(z.string()).optional(),
          locales: z.array(
            z.object({
              language: z.string(),
              question: z.string(),
              correct: z.string(),
              wrong: z.array(z.string()),
              isValid: z.boolean(),
            }),
          ),
          isValid: z.boolean().optional(),
        }),
      },
    },
  },
};
