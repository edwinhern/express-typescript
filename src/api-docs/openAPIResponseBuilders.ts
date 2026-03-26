import { StatusCodes } from "http-status-codes";
import type { z } from "zod";

import { ServiceResponseSchema } from "@/common/models/serviceResponse";

export function createApiResponse(schema: z.ZodType, description: string, statusCode = StatusCodes.OK) {
	return {
		[statusCode]: {
			description,
			content: {
				"application/json": {
					schema: ServiceResponseSchema(schema),
				},
			},
		},
	};
}

// Use if you want multiple responses for a single endpoint

// import { ResponseConfig } from '@asteasolutions/zod-to-openapi';
// import { ApiResponseConfig } from '@common/models/openAPIResponseConfig';
// export type ApiResponseConfig = {
//   schema: z.ZodType;
//   description: string;
//   statusCode: StatusCodes;
// };
// export function createApiResponses(configs: ApiResponseConfig[]) {
//   const responses: { [key: string]: ResponseConfig } = {};
//   configs.forEach(({ schema, description, statusCode }) => {
//     responses[statusCode] = {
//       description,
//       content: {
//         'application/json': {
//           schema: ServiceResponseSchema(schema),
//         },
//       },
//     };
//   });
//   return responses;
// }
