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
  method: "get",
  path: "/categories/with-questions-count",
  tags: ["Categories"],
  summary: "Get all categories with questions count",
  description: "Get all categories with questions count",
  responses: createApiResponse(z.array(z.object({})), "Success", 200),
  security: [{ BearerAuth: [] }],
});
categoryRouter.get("/with-questions-count", accessTokenGuard, categoryController.getCategoriesWithQuestionsCount);

categoryRegistry.registerPath({
  method: "get",
  path: "/categories/{categoryId}",
  tags: ["Categories"],
  summary: "Get category by ID",
  description: "Get category by ID",
  parameters: [
    {
      name: "categoryId",
      in: "path",
      required: true,
      description: "ID of the category to retrieve",
      schema: {
        type: "string",
      },
    },
  ],
  responses: {},
  security: [{ BearerAuth: [] }],
});
categoryRouter.get(
  "/:categoryId",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        categoryId: z.string(),
      }),
    }),
  ),
  categoryController.getCategoryById,
);

categoryRegistry.registerPath({
  method: "post",
  path: "/categories",
  tags: ["Categories"],
  summary: "Create category",
  description: "Create category",
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              example: "Contemporary philosophy",
            },
            parentId: {
              type: "integer",
              example: 1515,
              nullable: true,
            },
            // ancestors: {
            //   type: "array",
            //   items: { type: "integer" },
            //   example: [1515],
            //   nullable: true,
            // },
            locales: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  language: { type: "string", example: "en" },
                  value: { type: "string", example: "Contemporary philosophy" },
                },
                required: ["language", "value"],
              },
              example: [
                { language: "en", value: "Contemporary philosophy" },
                { language: "ru", value: "Современная философия" },
                { language: "ua", value: "Сучасна філософія" },
              ],
            },
          },
          required: ["name", "locales"],
        },
      },
    },
  },
  responses: {
    201: {
      description: "Category created successfully",
    },
    400: {
      description: "Bad request",
    },
    401: {
      description: "Unauthorized",
    },
  },
  security: [{ BearerAuth: [] }],
});

categoryRouter.post(
  "/",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        name: z.string().min(1, "Name is required"),
        parentId: z.number().optional(),
        // ancestors: z.array(z.number()).optional(),
        locales: z
          .array(
            z.object({
              language: z.string().min(2).max(5),
              value: z.string().min(1, "Value is required"),
            }),
          )
          .min(1, "At least one locale is required"),
      }),
    }),
  ),
  categoryController.createCategory,
);

categoryRegistry.registerPath({
  method: "put",
  path: "/categories/:categoryId",
  tags: ["Categories"],
  summary: "Update category",
  description: "Update category",
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              example: "Contemporary philosophy",
            },
            parentId: {
              type: "integer",
              example: 1515,
              nullable: true,
            },
            ancestors: {
              type: "array",
              items: { type: "integer" },
              example: [1515],
              nullable: true,
            },
            locales: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  language: { type: "string", example: "en" },
                  value: { type: "string", example: "Updated philosophy" },
                },
                required: ["language", "value"],
              },
              example: [
                { language: "en", value: "Updated philosophy" },
                { language: "ru", value: "Обновленная философия" },
                { language: "ua", value: "Оновлена філософія" },
              ],
            },
          },
          required: ["name", "locales"],
        },
      },
    },
  },
  responses: {
    200: {
      description: "Category updated successfully",
    },
    400: {
      description: "Bad request",
    },
    401: {
      description: "Unauthorized",
    },
    404: {
      description: "Category not found",
    },
  },
  security: [{ BearerAuth: [] }],
});

categoryRouter.put(
  "/:categoryId",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        categoryId: z.string(),
      }),
      body: z.object({
        name: z.string().min(1, "Name is required"),
        parentId: z.number().optional(),
        ancestors: z.array(z.number()).optional(),
        locales: z
          .array(
            z.object({
              language: z.string().min(2).max(5),
              value: z.string().min(1, "Value is required"),
            }),
          )
          .min(1, "At least one locale is required"),
      }),
    }),
  ),
  categoryController.updateCategory,
);

categoryRegistry.registerPath({
  method: "delete",
  path: "/categories/{categoryId}",
  tags: ["Categories"],
  summary: "Delete category",
  description: "Delete category",
  responses: {
    200: {
      description: "Category deleted successfully",
    },
  },
  security: [{ BearerAuth: [] }],
});

categoryRouter.delete(
  "/:categoryId",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        categoryId: z.string(),
      }),
    }),
  ),
  categoryController.deleteCategory,
);

categoryRegistry.registerPath({
  method: "post",
  path: "/categories/translate",
  tags: ["Categories"],
  summary: "Translate category",
  description: "Translate category",
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            requiredLocales: {
              type: "array",
              items: { type: "string" },
              example: ["es", "fr", "ua"],
            },
            originalText: {
              type: "string",
              example: "Modern philosophy",
            },
            sourceLanguage: {
              type: "string",
              example: "en",
            },
          },
          required: ["requiredLocales", "originalText", "sourceLanguage"],
        },
      },
    },
  },
  responses: {
    200: {
      description: "Translations generated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              translations: {
                type: "object",
                additionalProperties: { type: "string" },
                example: {
                  es: "Filosofía moderna",
                  fr: "Philosophie moderne",
                  ua: "Сучасна філософія",
                },
              },
            },
          },
        },
      },
    },
    400: { description: "Bad request" },
    404: { description: "Category not found" },
    500: { description: "Internal server error" },
  },
});
categoryRouter.post(
  "/translate",
  accessTokenGuard,
  validateRequest(
    z.object({
      body: z.object({
        requiredLocales: z.array(z.string()).min(1),
        sourceLanguage: z.string().optional(),
        originalText: z.string().min(1),
      }),
    }),
  ),
  categoryController.translateCategory,
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

categoryRegistry.registerPath({
  method: "delete",
  path: "/categories/{categoryId}/clear-cache",
  tags: ["Categories"],
  summary: "Clear cache for category",
  description: "Clear cache for category",
  responses: createApiResponse(z.object({}), "Success", 200),
  security: [{ BearerAuth: [] }],
});

categoryRouter.delete(
  "/:categoryId/clear-cache",
  accessTokenGuard,
  validateRequest(
    z.object({
      params: z.object({
        categoryId: z.string(),
      }),
    }),
  ),
  categoryController.clearCache,
);
