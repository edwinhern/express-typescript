import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import type { IQuestionGenerationLog } from "./models/questionGenerationLog.model";
import { statsService } from "./statsService";

export class StatsController {
  getOpenAiTokenUsageStats: RequestHandler = async (req: Request, res: Response) => {
    const serviceResponse: ServiceResponse<any> = await statsService.getOpenAiTokenUsageStats();

    handleServiceResponse(serviceResponse, res);
  };

  getOpenAiUsageLogs: RequestHandler = async (req: Request, res: Response) => {
    const { from, to, minTokens, maxTokens } = req.query;
    const dateRange = {
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
    };

    const serviceResponse: ServiceResponse<IQuestionGenerationLog[]> = await statsService.getOpenAiUsageLogs(
      dateRange,
      minTokens ? Number.parseInt(minTokens as string) : undefined,
      maxTokens ? Number.parseInt(maxTokens as string) : undefined,
    );

    handleServiceResponse(serviceResponse, res);
  };

  clearOpenAiLogs: RequestHandler = async (req: Request, res: Response) => {
    const serviceResponse: ServiceResponse<null> = await statsService.clearOpenAiLogs();

    handleServiceResponse(serviceResponse, res);
  };

  getDeepLUsageLogs: RequestHandler = async (req: Request, res: Response) => {
    const { from, to, minTokens, maxTokens } = req.query;
    const dateRange = {
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
    };

    const serviceResponse: ServiceResponse<any> = await statsService.getDeepLUsageLogs(
      dateRange,
      minTokens ? Number.parseInt(minTokens as string) : undefined,
      maxTokens ? Number.parseInt(maxTokens as string) : undefined,
    );

    handleServiceResponse(serviceResponse, res);
  };

  getDeepLUsageStats: RequestHandler = async (req: Request, res: Response) => {
    const serviceResponse: ServiceResponse<any> = await statsService.getDeepLUsageStats();

    handleServiceResponse(serviceResponse, res);
  };

  clearDeepLLLogs: RequestHandler = async (req: Request, res: Response) => {
    const serviceResponse: ServiceResponse<null> = await statsService.clearDeepLLogs();

    handleServiceResponse(serviceResponse, res);
  };
}

export const statsController = new StatsController();
