import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import { authRegistry } from "@/api/auth/authRouter";
import { categoryRegistry } from "@/api/category/categoryRouter";
import { healthCheckRegistry } from "@/api/healthCheck/healthCheckRouter";
// import { openaiRegistry } from "@/api/openai/openaiRouter";
// import { questionRegistry } from "@/api/question/questionRouter";

import { questionRegistry } from "@/api/question/questionSwagger";
import { statsRegistry } from "@/api/stats/statsRouter";
import { userRegistry } from "@/api/user/userRouter";

export function generateOpenAPIDocument() {
  const registry = new OpenAPIRegistry([
    healthCheckRegistry,
    userRegistry,
    authRegistry,
    // openaiRegistry,
    questionRegistry,
    statsRegistry,
    categoryRegistry,
  ]);
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Swagger API",
    },
    externalDocs: {
      description: "View the raw OpenAPI Specification in JSON format",
      url: "/swagger.json",
    },
  });
}
