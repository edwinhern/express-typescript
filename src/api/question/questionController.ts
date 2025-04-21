import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import { type translatedQuestionResponse, translationService } from "../translation/translationService";
import type { GenerateQuestionsDto } from "./dto/generate-questions.dto";
import type { GetQuestionFiltersDto } from "./dto/get-question-filters.dto";
import type { IQuestion } from "./models/question.model";
import { questionService } from "./questionService";

export class QuestionController {
  getQuestions: RequestHandler = async (req: Request, res: Response) => {
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

  rejectGeneratedQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse: ServiceResponse<{
      deletedCount: number;
    } | null> = await questionService.rejectGeneratedQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  rejectGeneratedQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;
    const serviceResponse = await questionService.rejectGeneratedQuestions(ids);

    handleServiceResponse(serviceResponse, res);
  };

  translateQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;
    const { language } = req.body;

    const serviceResponse: ServiceResponse<translatedQuestionResponse | null> =
      await translationService.translateQuestion(questionId, language);

    handleServiceResponse(serviceResponse, res);
  };

  translateGeneratedQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;
    const { language } = req.body;

    const serviceResponse = await translationService.translateGeneratedQuestion(questionId, language);

    handleServiceResponse(serviceResponse, res);
  };

  generateQuestions: RequestHandler = async (req: Request, res: Response) => {
    const generateQuestionsDto: GenerateQuestionsDto = req.body;
    const serviceResponse = await questionService.generateQuestions(generateQuestionsDto);

    handleServiceResponse(serviceResponse, res);
  };

  parseQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { categoryId, boilerplateText, language, type } = req.body;
    const serviceResponse = await questionService.parseQuestions(categoryId, boilerplateText, language, type);

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

  confirmGeneratedQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const serviceResponse = await questionService.confirmGeneratedQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  confirmGeneratedQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;
    const serviceResponse = await questionService.confirmGeneratedQuestions(ids);

    handleServiceResponse(serviceResponse, res);
  };

  updateQuestion: RequestHandler = async (req: Request, res: Response) => {
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

  confirmQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;

    const serviceResponse = await questionService.confirmQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  rejectQuestion: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;

    const serviceResponse = await questionService.rejectQuestion(id);

    handleServiceResponse(serviceResponse, res);
  };

  confirmQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;

    throw new Error("Not implemented");

    // const serviceResponse = await questionService.confirmQuestions(ids);

    // handleServiceResponse(serviceResponse, res);
  };

  rejectQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;

    throw new Error("Not implemented");

    // const serviceResponse = await questionService.rejectQuestions(ids);

    // handleServiceResponse(serviceResponse, res);
  };

  validateTranslation: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;
    const { originalLanguage, targetLanguage } = req.body;

    const serviceResponse = await questionService.validateTranslation(questionId, originalLanguage, targetLanguage);

    handleServiceResponse(serviceResponse, res);
  };

  validateGeneratedTranslation: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;
    const { originalLanguage, targetLanguage } = req.body;

    const serviceResponse = await questionService.validateGeneratedTranslation(
      questionId,
      originalLanguage,
      targetLanguage,
    );

    handleServiceResponse(serviceResponse, res);
  };

  validateGeneratedQuestionCorrectness: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;

    const serviceResponse = await questionService.validateGeneratedQuestionCorrectness(questionId);
    handleServiceResponse(serviceResponse, res);
  };

  validateQuestionCorrectness: RequestHandler = async (req: Request, res: Response) => {
    const { questionId } = req.params;

    const serviceResponse = await questionService.validateQuestionCorrectness(questionId);
    handleServiceResponse(serviceResponse, res);
  };

  validateGeneratedQuestionsCorrectness: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;

    const serviceResponse = await questionService.validateGeneratedQuestionsCorrectness(ids);
    handleServiceResponse(serviceResponse, res);
  };

  validateQuestionsCorrectness: RequestHandler = async (req: Request, res: Response) => {
    const { ids } = req.body;

    const serviceResponse = await questionService.validateQuestionsCorrectness(ids);
    handleServiceResponse(serviceResponse, res);
  };

  checkForDuplicateQuestions: RequestHandler = async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const serviceResponse = await questionService.checkForDuplicateQuestions(categoryId);
    handleServiceResponse(serviceResponse, res);
  };
}

export const questionController = new QuestionController();
