import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import type { IQuestion } from "./questionModel";
import { questionService } from "./questionService";

export class QuestionController {
  getQuestions: RequestHandler = async (req: Request, res: Response) => {
    const serviceResponse: ServiceResponse<IQuestion[]> = await questionService.getQuestions();

    handleServiceResponse(serviceResponse, res);
  };

  getQuestionsByCategory: RequestHandler = async (req: Request, res: Response) => {
    const { category } = req.params;
    const serviceResponse: ServiceResponse<IQuestion[] | null> = await questionService.getQuestionsByCategory(category);

    handleServiceResponse(serviceResponse, res);
  };
}

export const questionController = new QuestionController();
