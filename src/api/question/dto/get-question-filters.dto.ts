import type { QuestionStatus, QuestionType } from "../models/question.model";

export class GetQuestionFiltersDto {
  readonly limit?: number = 10;
  readonly page?: number = 1;
  readonly difficulty?: number;
  readonly status?: QuestionStatus;
  readonly type?: QuestionType;
  readonly title?: string;
}
