import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { ZodError, ZodSchema } from "zod";

import { ServiceResponse } from "@/common/models/serviceResponse";

export const validateRequest = (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
	try {
		await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
		next();
	} catch (err) {
		const errors = (err as ZodError).errors.map((e) => {
			const fieldPath = e.path.length > 0 ? e.path.join(".") : "root";
			return `${fieldPath}: ${e.message}`;
		});

		const errorMessage =
			errors.length === 1
				? `Invalid input: ${errors[0]}`
				: `Invalid input (${errors.length} errors): ${errors.join("; ")}`;

		const statusCode = StatusCodes.BAD_REQUEST;
		const serviceResponse = ServiceResponse.failure(errorMessage, null, statusCode);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	}
};
