import { z } from "zod";

export const validateGetGeneratedQuestions = z.object({
  query: z.object({
    limit: z
      .string()
      .transform((v) => (v ? +v : 10))
      .optional(),
    page: z
      .string()
      .transform((v) => (v ? +v : 1))
      .optional(),
  }),
});
