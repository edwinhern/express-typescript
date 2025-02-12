import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const PostAuthSchema = z.object({
  body: z.object({
    username: z.string().min(3, "Username must be at least 3 characters long"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
  }),
});

export const AuthResponseSchema = z.object({
  token: z.string(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
