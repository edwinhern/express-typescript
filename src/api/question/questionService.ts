import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { type IQuestion, QuestionModel } from "./questionModel";

export class QuestionService {
  async getQuestions(): Promise<ServiceResponse<IQuestion[]>> {
    const questions = await QuestionModel.find();

    return ServiceResponse.success<IQuestion[]>("Questions found", questions);
  }

  async getQuestionsByCategory(category: string): Promise<ServiceResponse<IQuestion[] | null>> {
    const questions = await QuestionModel.find({ category });

    if (!questions || questions.length === 0) {
      return ServiceResponse.failure("No Questions found", null, StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success<IQuestion[]>("Questions found", questions);
  }

  async saveQuestions(questions: IQuestion[]): Promise<ServiceResponse<IQuestion[]>> {
    const savedQuestions = await QuestionModel.insertMany(questions);

    return ServiceResponse.success<IQuestion[]>("Questions saved", savedQuestions);
  }
}

export const questionService = new QuestionService();
