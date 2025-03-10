import type { QuestionType } from "../models/question.model";

export interface GenerateQuestionsDto {
  readonly prompt: string;
  // readonly max_tokens: number;
  readonly count: number;
  readonly category: number;
  readonly type: QuestionType;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly requiredLanguages: string[];
  readonly temperature: number;
  readonly model:
    | "gpt-3.5-turbo"
    | "gpt-4-turbo"
    | "gpt-4"
    | "gpt-4o"
    | "gpt-4o-mini"
    | "o1"
    | "o1-mini"
    | "o3"
    | "o3-mini";
}
