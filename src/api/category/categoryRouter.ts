import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { accessTokenGuard } from "../auth/middlewares/accessToken.middleware";
import { categoryController } from "./categoryController";

export const categoryRegistry = new OpenAPIRegistry();
export const categoryRouter: Router = express.Router();

categoryRegistry.registerPath({
  method: "get",
  path: "/categories",
  tags: ["Categories"],
  summary: "Get all categories",
  description: "Get all categories",
  responses: createApiResponse(z.object({}), "Success", 200),
  security: [{ BearerAuth: [] }],
});

categoryRouter.get(
  "/",
  accessTokenGuard,
  validateRequest(
    z.object({
      limit: z.number().optional(),
      page: z.number().optional(),
      title: z.string().optional(),
    }),
  ),
  categoryController.getCategories,
);

categoryRegistry.registerPath({
  method: "post",
  path: "/categories/sync",
  tags: ["Categories"],
  summary: "Sync categories",
  description: "Sync categories",
  responses: createApiResponse(z.object({}), "Success", 200),
  security: [{ BearerAuth: [] }],
});

categoryRouter.post("/sync", accessTokenGuard, categoryController.syncCategories);
