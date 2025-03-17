import { z } from "zod";

export const validateGenerateQuestions = z.object({
  body: z.object({
    prompt: z.string(),
    count: z.number(),
    category: z.number(),
    difficulty: z.number().min(1).max(5).optional(),
    temperature: z.number().min(0).max(2).optional(),
    // model: z.string().default("gpt-3.5-turbo").optional(),
    model: z
      .enum(["gpt-3.5-turbo", "gpt-4-turbo", "gpt-4", "gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "o3", "o3-mini"])
      .default("gpt-4o")
      .optional(),
    type: z.enum(["map", "choice"]).optional(),
    requiredLanguages: z.array(z.string().min(2).max(2, { message: "Language code must be 2 characters" })),
  }),
});
