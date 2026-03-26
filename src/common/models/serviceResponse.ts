import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export class ServiceResponse<T = null> {
	readonly success: boolean;
	readonly message: string;
	readonly responseObject: T;
	readonly statusCode: number;

	private constructor(success: boolean, message: string, responseObject: T, statusCode: number) {
		this.success = success;
		this.message = message;
		this.responseObject = responseObject;
		this.statusCode = statusCode;
	}

	static success<T>(message: string, responseObject: T, statusCode: number = StatusCodes.OK) {
		return new ServiceResponse(true, message, responseObject, statusCode);
	}

	static failure<T>(message: string, responseObject: T, statusCode: number = StatusCodes.BAD_REQUEST) {
		return new ServiceResponse(false, message, responseObject, statusCode);
	}
}

export const ServiceResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
	z.object({
		success: z.boolean(),
		message: z.string(),
		responseObject: dataSchema.optional(),
		statusCode: z.number(),
	});
