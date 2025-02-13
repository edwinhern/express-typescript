import mongoose, { Schema, type Document } from "mongoose";

export interface IQuestion extends Document {
  language: string;
  question: string;
  correct: string;
  wrong: string[];
  category: string;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    language: { type: String, required: true },
    question: { type: String, required: true },
    correct: { type: String, required: true },
    wrong: { type: [String], required: true },
    category: { type: String, required: true },
  },
  { timestamps: true },
);

export const QuestionModel = mongoose.model<IQuestion>("Question", QuestionSchema);
