import { logger } from "@/server";
import { StatusCodes } from "http-status-codes";
import { ServiceResponse } from "../models/serviceResponse";

export default function logError(error: unknown, baseMessage: string) {
  logger.error(`${baseMessage}: ${error}`);
  return ServiceResponse.failure(
    error instanceof Error ? `${baseMessage}: ${error.message}` : baseMessage,
    null,
    StatusCodes.INTERNAL_SERVER_ERROR,
  );
}
