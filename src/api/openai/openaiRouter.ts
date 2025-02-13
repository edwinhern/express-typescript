import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { openaiController } from "./openatController";

export const openaiRegistry = new OpenAPIRegistry();
export const openaiRouter: Router = express.Router();

openaiRegistry.registerPath({
  method: "post",
  path: "/openai/generate-questions",
  tags: ["Questions"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            prompt: z.string(),
            max_tokens: z.number().optional(),
            count: z.number(),
            category: z.string(),
          }),
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({
      questions: z.array(z.string()),
    }),
    "Success",
  ),
  security: [{ BearerAuth: [] }],
});

openaiRouter.post(
  "/generate-questions",
  validateRequest(
    z.object({
      body: z.object({
        prompt: z.string(),
        max_tokens: z.number().optional(),
        count: z.number(),
        category: z.string(),
      }),
    }),
  ),
  openaiController.generateQuestions,
);
