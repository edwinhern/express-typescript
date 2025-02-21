import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { questionController } from "./questionController";

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
  method: "post",
  path: "/questions/generate",
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
  responses: createApiResponse(z.object({ questions: z.array(QuestionSchema) }), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.post("/generate", accessTokenGuard, questionController.generateQuestions);

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
  method: "patch",
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

questionRouter.patch("/:id/confirm", accessTokenGuard, questionController.confirmQuestion);

questionRegistry.registerPath({
  method: "patch",
  path: "/questions/{id}/reject",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.patch("/:id/reject", accessTokenGuard, questionController.rejectQuestion);

questionRegistry.registerPath({
  method: "patch",
  path: "/questions/{id}/translate/{language}/approve",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
      language: z
        .string()
        .min(2, { message: "Language code is required" })
        .max(2, { message: "Language code must be 2 characters" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.patch(
  "/:id/translate/:language/approve",
  accessTokenGuard,
  questionController.confirmQuestionTranslation,
);

questionRegistry.registerPath({
  method: "patch",
  path: "/questions/{id}/translate/{language}/reject",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
      language: z
        .string()
        .min(2, { message: "Language code is required" })
        .max(2, { message: "Language code must be 2 characters" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.patch("/:id/translate/:language/reject", accessTokenGuard, questionController.rejectQuestionTranslation);

questionRegistry.registerPath({
  method: "post",
  path: "/questions/translate/{questionId}",
  tags: ["Questions"],
  request: {
    params: z.object({
      questionId: z.string().min(1, { message: "Question ID is required" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            language: z.string().min(2, { message: "Language code is required" }),
          }),
          examples: {
            Deutsch: {
              value: {
                language: "de",
              },
              description: "Translate to German",
            },
            Français: {
              value: {
                language: "fr",
              },
              description: "Translate to French",
            },
            Español: {
              value: {
                language: "es",
              },
              description: "Translate to Spanish",
            },
            Ukrainian: {
              value: {
                language: "uk",
              },
              description: "Translate to Ukrainian",
            },
          },
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({
      translatedText: z.string().nullable(),
    }),
    "Success",
  ),
  security: [{ BearerAuth: [] }],
});

questionRouter.post(
  "/translate/:questionId",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        language: z
          .string()
          .min(2, { message: "Language code is required" })
          .max(2, { message: "Language code must be 2 characters" }),
      }),
      params: z.object({
        questionId: z.string(),
      }),
    }),
  ),
  questionController.translateQuestion,
);

questionRegistry.registerPath({
  method: "patch",
  path: "/questions/{id}/status",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum(["proof_reading", "approved", "rejected", "pending"]),
          }),
        },
      },
    },
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.patch("/:id/status", accessTokenGuard, questionController.updateQuestionStatus);

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/{id}",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.delete("/:id", accessTokenGuard, questionController.deleteQuestion);

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/{id}/translate/{language}",
  tags: ["Questions"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
      language: z
        .string()
        .min(2, { message: "Language code is required" })
        .max(2, { message: "Language code must be 2 characters" }),
    }),
  },
  responses: createApiResponse(QuestionSchema, "Success"),
  security: [{ BearerAuth: [] }],
});

questionRouter.delete("/:id/translate/:language", accessTokenGuard, questionController.deleteQuestionTranslation);
