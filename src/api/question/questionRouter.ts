import { validateRequest } from "@/common/utils/httpHandlers";
import express, { type Router } from "express";
import { z } from "zod";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { questionController } from "./questionController";
import {
  validateGenerateQuestions,
  validateGetGeneratedQuestions,
  validateTranslationRequest,
  validateUpdateQuestion,
} from "./validators";

export const questionRouter: Router = express.Router();

questionRouter.get("/history", accessTokenGuard, questionController.getQuestions);

//#region Question Routes - (not generated)
questionRouter.post(
  "/generate",
  accessTokenGuard,
  validateRequest(validateGenerateQuestions),
  questionController.generateQuestions,
);

questionRouter.post(
  "/parse",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        categoryId: z.number().int().positive(),
        boilerplateText: z.string(),
        language: z.string().min(2).max(2),
        type: z.enum(["choice", "map"], { message: "Invalid question type" }),
      }),
    }),
  ),
  questionController.parseQuestions,
);

questionRouter.get(
  "/generated",
  accessTokenGuard,
  validateRequest(validateGetGeneratedQuestions),
  questionController.getGeneratedQuestions,
);

questionRouter.get("/:id", accessTokenGuard, questionController.getQuestion);

questionRouter.put(
  "/history/:id",
  accessTokenGuard,
  validateRequest(validateUpdateQuestion),
  questionController.updateQuestion,
);

questionRouter.post(
  "/history/translate/:questionId",
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

questionRouter.post(
  "/history/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.confirmQuestions,
);

questionRouter.post(
  "/history/:id/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.confirmQuestion,
);

questionRouter.delete(
  "/history/reject",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.rejectQuestions,
);

questionRouter.delete(
  "/history/:id/reject",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.rejectQuestion,
);

questionRouter.delete("/:id", accessTokenGuard, questionController.deleteQuestion);

//#endregion

//#region Generated Question Routes

questionRouter.get(
  "/generated/:id",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.getGeneratedQuestion,
);

questionRouter.put(
  "/generated/:id",
  accessTokenGuard,
  validateRequest(validateUpdateQuestion),
  questionController.updateGeneratedQuestion,
);

questionRouter.post(
  "/generated/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.confirmGeneratedQuestions,
);

questionRouter.delete(
  "/generated/reject",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.rejectGeneratedQuestions,
);

questionRouter.delete("/generated/:id/reject", accessTokenGuard, questionController.rejectGeneratedQuestion);

questionRouter.post(
  "/generated/:id/confirm",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        id: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.confirmGeneratedQuestion,
);

questionRouter.post(
  "/generated/translate/:questionId",
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
  questionController.translateGeneratedQuestion,
);

questionRouter.post(
  "/history/validate-translation/:questionId",
  accessTokenGuard,
  validateRequest(validateTranslationRequest),
  questionController.validateTranslation,
);

questionRouter.post(
  "/history/validate-correctness/:questionId",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        questionId: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.validateQuestionCorrectness,
);

questionRouter.post(
  "/generated/check-duplicates/:categoryId",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        categoryId: z.string().min(1, { message: "Category ID is required" }),
      }),
    }),
  ),
  questionController.checkForDuplicateQuestions,
);

questionRouter.post(
  "/generated/validate-translation/:questionId",
  accessTokenGuard,
  validateRequest(validateTranslationRequest),
  questionController.validateGeneratedTranslation,
);

questionRouter.post(
  "/generated/validate-correctness/:questionId",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        questionId: z.string().min(1, { message: "Question ID is required" }),
      }),
    }),
  ),
  questionController.validateGeneratedQuestionCorrectness,
);

questionRouter.post(
  "/generated/validate-correctness-batch",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.validateGeneratedQuestionsCorrectness,
);

questionRouter.post(
  "/history/validate-correctness-batch",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        ids: z.array(z.string()),
      }),
    }),
  ),
  questionController.validateQuestionsCorrectness,
);

//#endregion
