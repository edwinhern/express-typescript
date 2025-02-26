import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";

export const healthCheckRegistry = new OpenAPIRegistry();
export const healthCheckRouter: Router = express.Router();

healthCheckRegistry.registerPath({
  method: "get",
  path: "/health-check",
  tags: ["Health Check"],
  responses: createApiResponse(z.null(), "Success"),
});

healthCheckRouter.get("/", (_req: Request, res: Response) => {
  const serviceResponse = ServiceResponse.success("Service is healthy", null);
  return handleServiceResponse(serviceResponse, res);
});

healthCheckRegistry.registerPath({
  method: "get",
  path: "/health-check/error",
  tags: ["Health Check"],
  responses: createApiResponse(z.null(), "Error"),
});

healthCheckRouter.get("/error", (_req: Request, res: Response) => {
  const serviceResponse = ServiceResponse.failure("Service is unhealthy", null);
  return handleServiceResponse(serviceResponse, res);
});
