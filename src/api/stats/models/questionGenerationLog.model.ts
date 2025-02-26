import mongoose, { Schema, type Document } from "mongoose";

export interface IQuestionGenerationLog extends Document {
  categoryId: mongoose.Types.ObjectId;
  questionIds: (string | mongoose.Types.ObjectId)[];
  tokensUsed: number;
  requestPrompt: string;
  createdAt: Date;
}

const QuestionGenerationLogSchema = new Schema<IQuestionGenerationLog>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    questionIds: [{ type: Schema.Types.Mixed, required: true }],
    tokensUsed: { type: Number, required: true },
    requestPrompt: { type: String, required: true },
  },
  { timestamps: true },
);

export const QuestionGenerationLogModel = mongoose.model<IQuestionGenerationLog>(
  "QuestionGenerationLog",
  QuestionGenerationLogSchema,
);
