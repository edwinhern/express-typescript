import { z } from "zod";

export const validateTranslationRequest = z.object({
  body: z.object({
    originalLanguage: z
      .string()
      .min(2, { message: "Language code is required" })
      .max(2, { message: "Language code must be 2 characters" }),
    targetLanguage: z
      .string()
      .min(2, { message: "Language code is required" })
      .max(2, { message: "Language code must be 2 characters" }),
  }),
  params: z.object({
    questionId: z.string().min(1, { message: "Question ID is required" }),
  }),
});
