import type { QuestionType } from "../models/question.model";

export interface GenerateQuestionsOpenAIDto {
  prompt: string;
  count: number;
  category: string;
  type: QuestionType;
  requiredLanguages: string[];
}
