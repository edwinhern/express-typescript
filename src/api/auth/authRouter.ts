import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { authController } from "./authController";
import { AuthResponseSchema, PostAuthSchema } from "./authModel";
import { accessTokenGuard } from "./middlewares/accessToken.middleware";
import { refreshTokenGuard } from "./middlewares/refreshToken.middleware";

export const authRegistry = new OpenAPIRegistry();
export const authRouter: Router = express.Router();

authRegistry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Enter JWT Bearer token",
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: PostAuthSchema.shape.body,
          example: {
            username: "root",
            password: "root_password",
          },
        },
      },
    },
  },
  responses: createApiResponse(AuthResponseSchema, "Success"),
});

authRouter.post("/login", validateRequest(PostAuthSchema), authController.login);

authRegistry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  security: [{ BearerAuth: [] }],
  responses: createApiResponse(AuthResponseSchema, "Success"),
});
authRouter.post("/refresh", refreshTokenGuard, authController.refresh);

authRegistry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  security: [{ BearerAuth: [] }],
  responses: createApiResponse(
    z.object({
      sessionId: z.string(),
    }),
    "Success",
  ),
});
authRouter.get("/me", accessTokenGuard, authController.me);
