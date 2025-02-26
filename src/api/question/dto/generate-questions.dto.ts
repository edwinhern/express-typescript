import type { QuestionType } from "../models/question.model";

export interface GenerateQuestionsDto {
  readonly prompt: string;
  readonly max_tokens: number;
  readonly count: number;
  readonly category: string;
  readonly type: QuestionType;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly requiredLanguages: string[];
}
