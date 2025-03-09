import mongoose, { Schema, type Document } from "mongoose";
import type { ICategory } from "./category.model";

export type QuestionStatus = "proof_reading" | "approved" | "rejected" | "pending";

export interface ILocaleSchema {
  language: string;
  question: string;
  correct: string;
  wrong: string[];
  isValid: boolean;
}

export enum QuestionType {
  TrueFalse = "true_false",
  MultipleChoice = "multiple_choice",
  OneChoice = "one_choice",
}

export interface IQuestion extends Document {
  // categoryId: mongoose.Types.ObjectId | ICategory;
  categoryId: number | ICategory;
  status: QuestionStatus;
  track?: string;
  type: QuestionType;
  difficulty: number; // 1-5
  requiredLanguages: string[];
  audioId?: string;
  imageId?: string;
  authorId?: string;
  tags: string[];
  locales: ILocaleSchema[];
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LocaleSchema = new Schema<ILocaleSchema>({
  language: { type: String, required: true },
  question: { type: String, required: true },
  correct: { type: String, required: true },
  wrong: { type: [String], required: true },
  isValid: { type: Boolean, default: false },
});

const QuestionSchema = new Schema<IQuestion>(
  {
    categoryId: { type: Number, ref: "Category", required: true },
    status: { type: String, enum: ["proof_reading", "approved", "rejected", "pending"], required: true },
    track: { type: String },
    type: { type: String, enum: Object.values(QuestionType), required: true, default: QuestionType.OneChoice },
    difficulty: { type: Number, min: 1, max: 5, required: true },
    requiredLanguages: { type: [String], required: true },
    audioId: { type: String },
    imageId: { type: String },
    authorId: { type: String },
    tags: { type: [String], required: true },
    locales: { type: [LocaleSchema], required: true },
    isValid: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const QuestionModel = mongoose.model<IQuestion>("Question", QuestionSchema);
