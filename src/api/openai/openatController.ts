import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import { openaiService } from "./openaiService";

export class OpenAiController {
  generateQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { prompt, max_tokens, count, category } = req.body;
    const serviceResponse = await openaiService.generateQuestions(prompt, max_tokens, count, category);

    handleServiceResponse(serviceResponse, res);
  };
}

export const openaiController = new OpenAiController();
