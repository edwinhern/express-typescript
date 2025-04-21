import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  generateQuestionRequestSchema,
  updateQuestionRequestSchema,
  validateTranslationRequestSchema,
} from "./swagger-schemas";

export const questionRegistry = new OpenAPIRegistry();

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generate",
  tags: ["Questions"],
  request: generateQuestionRequestSchema,
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/parse",
  tags: ["Questions"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            categoryId: z.number().int().positive(),
            boilerplateText: z.string(),
            language: z.string().min(2).max(2),
            type: z.enum(["choice", "map"], { message: "Invalid question type" }),
          }),
        },
      },
    },
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "get",
  path: "/questions/history",
  tags: ["Questions (History)"],
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "get",
  path: "/questions/generated",
  tags: ["Questions (Generated)"],
  request: {
    query: z.object({
      limit: z.number().optional(),
      page: z.number().optional(),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "get",
  path: "/questions/generated/{id}",
  tags: ["Questions (Generated)"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "get",
  path: "/questions/history/{id}",
  tags: ["Questions (History)"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "put",
  path: "/questions/history/{id}",
  tags: ["Questions (History)"],
  description: "Update a question",
  request: updateQuestionRequestSchema,
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "put",
  path: "/questions/generated/{id}",
  tags: ["Questions (Generated)"],
  description: "Update a generated question",
  request: updateQuestionRequestSchema,
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generated/confirm",
  tags: ["Questions (Generated)"],
  description: "Save the questions to the database (by default the questions saved in the Redis cache only)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/history/confirm",
  tags: ["Questions (History)"],
  description: "Save the questions to the main database, by default the questions saved in the internal database only",
  summary: "Save the questions to the main database",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/history/{id}/confirm",
  tags: ["Questions (History)"],
  description: "Save the question to the main database, by default the question saved in the internal database only",
  summary: "Save the question to the main database",
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/generated/reject",
  tags: ["Questions (Generated)"],
  description: "Reject the questions",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/history/{id}/reject",
  tags: ["Questions (History)"],
  description: "Reject the question (remove from the main database)",
  summary: "Reject the question (remove from the main database)",
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/history/reject",
  tags: ["Questions (History)"],
  description: "Reject the questions (remove from the main database)",
  summary: "Reject the questions (remove from the main database)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/generated/{id}/reject",
  tags: ["Questions (Generated)"],
  description: "Set field 'valid' to false",
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generated/{id}/confirm",
  tags: ["Questions (Generated)"],
  description: "Save the question to the database (by default the question saved in the Redis cache only)",
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/history/translate/{questionId}",
  tags: ["Questions (History)"],
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

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generated/translate/{questionId}",
  tags: ["Questions (Generated)"],
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
      language: z.string(),
      question: z.string(),
      correct: z.string(),
      wrong: z.array(z.string()),
      isValid: z.boolean(),
    }),
    "Success",
  ),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "delete",
  path: "/questions/history/{id}",
  tags: ["Questions (History)"],
  request: {
    params: z.object({
      id: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/history/validate-translation/{questionId}",
  tags: ["Questions (History)"],
  request: validateTranslationRequestSchema,
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

// This route needed for validation of translation for generated questions
questionRegistry.registerPath({
  method: "post",
  path: "/questions/generated/validate-translation/{questionId}",
  tags: ["Questions (Generated)"],
  request: validateTranslationRequestSchema,
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/history/validate-correctness/{questionId}",
  tags: ["Questions (History)"],
  request: {
    params: z.object({
      questionId: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generated/validate-correctness/{questionId}",
  tags: ["Questions (Generated)"],
  request: {
    params: z.object({
      questionId: z.string().min(1, { message: "Question ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generated/validate-correctness-batch",
  tags: ["Questions (Generated)"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/history/validate-correctness-batch",
  tags: ["Questions (History)"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});

questionRegistry.registerPath({
  method: "post",
  path: "/questions/generated/check-duplicates/{categoryId}",
  tags: ["Questions (Generated)"],
  request: {
    params: z.object({
      categoryId: z.string().min(1, { message: "Category ID is required" }),
    }),
  },
  responses: createApiResponse(z.object({}), "Success"),
  security: [{ BearerAuth: [] }],
});
