import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { questionController } from "./questionController";
import { IQuestion } from "./questionModel";

export const questionRegistry = new OpenAPIRegistry();
export const questionRouter: Router = express.Router();

const QuestionSchema = z.object({
  language: z.string(),
  question: z.string(),
  correct: z.string(),
  wrong: z.array(z.string()),
  category: z.string(),
});

questionRegistry.registerPath({
  method: "get",
  path: "/questions",
  tags: ["Questions"],
  responses: createApiResponse(z.array(QuestionSchema), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.get("/", accessTokenGuard, questionController.getQuestions);

questionRegistry.registerPath({
  method: "get",
  path: "/questions/{category}",
  tags: ["Questions"],
  request: {
    params: z.object({
      category: z.string().min(1, { message: "Category is required" }),
    }),
  },
  responses: createApiResponse(z.array(QuestionSchema), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.get("/:category", accessTokenGuard, questionController.getQuestionsByCategory);

questionRegistry.registerPath({
  method: "post",
  path: "/questions/{id}/approve",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});
