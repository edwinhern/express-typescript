import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import type { GenerateQuestionsDto } from "./dto/generate-questions.dto";
import type { GetQuestionFiltersDto } from "./dto/get-question-filters.dto";
import type { IQuestion } from "./models/question.model";
import { questionService, type translatedQuestionResponse } from "./questionService";

export class QuestionController {
  getQuestions: RequestHandler = async (req: Request, res: Response) => {
    // const { limit = 10, page = 1 } = req.query;
    const serviceResponse = await questionService.getQuestions(req.query as GetQuestionFiltersDto);

    handleServiceResponse(serviceResponse, res);
  };

  getQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse = await questionService.getQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  getGeneratedQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { limit = 10, page = 1 } = req.query;

    const serviceResponse = await questionService.getGeneratedQuestions(+limit, +page);

    handleServiceResponse(serviceResponse, res);
  };

  getGeneratedQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;

    const serviceResponse = await questionService.getGeneratedQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  approveQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse: ServiceResponse<IQuestion | null> = await questionService.approveQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  rejectQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    // const { sessionId } = req.user!;
    const serviceResponse: ServiceResponse<IQuestion | null> = await questionService.rejectQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  rejectQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;
    // const { sessionId } = req.user!;
    const serviceResponse = await questionService.rejectQuestions(ids);

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

  translateGeneratedQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;
    const { language } = req.body;

    const serviceResponse = await questionService.translateGeneratedQuestion(questionId, language);

    handleServiceResponse(serviceResponse, res);
  };

  generateQuestions: RequestHandler = async (req: Request, res: Response) => {
    const generateQuestionsDto: GenerateQuestionsDto = req.body;
    // const { sessionId } = req.user!;
    // const serviceResponse = await questionService.generateQuestions(sessionId, generateQuestionsDto);
    const serviceResponse = await questionService.generateQuestions(generateQuestionsDto);

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
    // const { sessionId } = req.user!;

    const serviceResponse = await questionService.confirmQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  confirmQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;
    // const { sessionId } = req.user!;
    const serviceResponse = await questionService.confirmQuestions(ids);

    handleServiceResponse(serviceResponse, res);
  };

  updateQuestion: RequestHandler = async (req: Request, res: Response) => {
    // return res.status(501).json({ message: "Not implemented" });

    const { id } = req.params;
    const question = req.body;

    const serviceResponse = await questionService.updateQuestion(id, question);

    handleServiceResponse(serviceResponse, res);
  };

  updateGeneratedQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const question = req.body;

    const serviceResponse = await questionService.updateGeneratedQuestion(id, question);

    handleServiceResponse(serviceResponse, res);
  };
}

export const questionController = new QuestionController();
