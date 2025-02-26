import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import type { GenerateQuestionsDto } from "./dto/generate-questions.dto";
import type { IQuestion } from "./models/question.model";
import { questionService, type translatedQuestionResponse } from "./questionService";

export class QuestionController {
  getQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { limit = 10, page = 1 } = req.query;
    const serviceResponse = await questionService.getQuestions(+limit, +page);

    handleServiceResponse(serviceResponse, res);
  };

  getQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse = await questionService.getQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  getGeneratedQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { sessionId } = req.user!;
    const { limit = 10, page = 1 } = req.query;

    const serviceResponse = await questionService.getGeneratedQuestions(sessionId, +limit, +page);

    handleServiceResponse(serviceResponse, res);
  };

  getQuestionsByCategory: RequestHandler = async (req: Request, res: Response) => {
    const { category } = req.params;
    const serviceResponse: ServiceResponse<IQuestion[] | null> = await questionService.getQuestionsByCategory(category);

    handleServiceResponse(serviceResponse, res);
  };

  approveQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse: ServiceResponse<IQuestion | null> = await questionService.approveQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  rejectQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sessionId } = req.user!;
    const serviceResponse: ServiceResponse<IQuestion | null> = await questionService.rejectQuestion(id, sessionId);

    handleServiceResponse(serviceResponse, res);
  };

  approveQuestionTranslation: RequestHandler = async (req: Request, res: Response) => {
    const { id, language } = req.params;

    const serviceResponse = await questionService.approveQuestionTranslation(id, language);

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
    const generateQuestionsDto: GenerateQuestionsDto = req.body;
    const { sessionId } = req.user!;
    const serviceResponse = await questionService.generateQuestions(sessionId, generateQuestionsDto);

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

  confirmQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sessionId } = req.user!;

    const serviceResponse = await questionService.confirmQuestion(sessionId, id);

    handleServiceResponse(serviceResponse, res);
  };

  updateQuestion: RequestHandler = async (req: Request, res: Response) => {
    // return res.status(501).json({ message: "Not implemented" });

    const { id } = req.params;
    const question = req.body;

    const serviceResponse = await questionService.updateQuestion(id, question);

    handleServiceResponse(serviceResponse, res);
  };
}

export const questionController = new QuestionController();
