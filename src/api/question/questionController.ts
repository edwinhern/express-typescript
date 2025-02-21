import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import type { IQuestion } from "./models/question.model";
import { questionService, type translatedQuestionResponse } from "./questionService";

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

  confirmQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse: ServiceResponse<IQuestion | null> = await questionService.confirmQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  rejectQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse: ServiceResponse<IQuestion | null> = await questionService.rejectQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  confirmQuestionTranslation: RequestHandler = async (req: Request, res: Response) => {
    const { id, language } = req.params;

    const serviceResponse = await questionService.confirmQuestionTranslation(id, language);

    handleServiceResponse(serviceResponse, res);
  };

  rejectQuestionTranslation: RequestHandler = async (req: Request, res: Response) => {
    const { id, language } = req.params;

    const serviceResponse = await questionService.rejectQuestionTranslation(id, language);

    handleServiceResponse(serviceResponse, res);
  };

  translateQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;
    const { language } = req.body;

    const serviceResponse: ServiceResponse<translatedQuestionResponse | null> = await questionService.translateQuestion(
      questionId,
      language,
    );

    handleServiceResponse(serviceResponse, res);
  };

  generateQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { prompt, max_tokens, count, category } = req.body;
    const serviceResponse = await questionService.generateQuestions(prompt, max_tokens, count, category);

    handleServiceResponse(serviceResponse, res);
  };

  updateQuestionStatus: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const serviceResponse = await questionService.updateQuestionStatus(id, status);

    handleServiceResponse(serviceResponse, res);
  };

  deleteQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;

    const serviceResponse = await questionService.deleteQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  deleteQuestionTranslation: RequestHandler = async (req: Request, res: Response) => {
    const { id, language } = req.params;

    const serviceResponse = await questionService.deleteQuestionTranslation(id, language);

    handleServiceResponse(serviceResponse, res);
  };
}

export const questionController = new QuestionController();
