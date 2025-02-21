import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { statsController } from "./statsController";

export const statsRegistry = new OpenAPIRegistry();
export const statsRouter: Router = express.Router();

statsRegistry.registerPath({
  method: "get",
  path: "/stats/openai/logs",
  tags: ["Stats"],
  request: {
    query: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      minTokens: z.string().optional(),
      maxTokens: z.string().optional(),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

statsRouter.get("/openai/logs", accessTokenGuard, statsController.getOpenAiUsageLogs);

statsRegistry.registerPath({
  method: "get",
  path: "/stats/openai/usage",
  tags: ["Stats"],
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

statsRouter.get("/openai/usage", accessTokenGuard, statsController.getOpenAiTokenUsageStats);

statsRegistry.registerPath({
  method: "delete",
  path: "/stats/openai/clear",
  tags: ["Stats"],
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

statsRouter.delete("/openai/clear", accessTokenGuard, statsController.clearOpenAiLogs);

statsRegistry.registerPath({
  method: "get",
  path: "/stats/deepl/logs",
  tags: ["Stats"],
  request: {
    query: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      minTokens: z.string().optional(),
      maxTokens: z.string().optional(),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

statsRouter.get("/deepl/logs", accessTokenGuard, statsController.getDeepLUsageLogs);

statsRegistry.registerPath({
  method: "get",
  path: "/stats/deepl/usage",
  tags: ["Stats"],
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

statsRouter.get("/deepl/usage", accessTokenGuard, statsController.getDeepLUsageStats);

statsRegistry.registerPath({
  method: "delete",
  path: "/stats/deepl/clear",
  tags: ["Stats"],
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

statsRouter.delete("/deepl/clear", accessTokenGuard, statsController.clearDeepLLLogs);
