import mongoose, { Schema, type Document } from "mongoose";
import type { ICategory } from "./category.model";

export type QuestionStatus = "generated" | "proof_reading" | "approved" | "rejected" | "pending" | "in_progress";

export interface ILocaleSchema {
  language: string;
  question: string;
  correct: string | [number, number];
  wrong?: string[];
  isValid: boolean;
}

export enum QuestionType {
  Choice = "choice",
  Map = "map",
}

export interface IQuestion extends Document {
  categoryId: number | ICategory;
  status: QuestionStatus;
  mainDbId?: number;
  track?: string;
  type: QuestionType;
  difficulty: number; // 1-5
  requiredLanguages: string[];
  audioId?: string;
  imageId?: string;
  authorId?: mongoose.Schema.Types.ObjectId;
  tags: string[];
  locales: ILocaleSchema[];
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LocaleSchema = new Schema<ILocaleSchema>({
  language: { type: String, required: true },
  question: { type: String, required: true },
  correct: { type: Schema.Types.Mixed, required: true },
  wrong: { type: [String], required: false },
  isValid: { type: Boolean, default: false },
});

const QuestionSchema = new Schema<IQuestion>(
  {
    categoryId: { type: Number, ref: "Category", required: true },
    mainDbId: { type: Number, required: false },
    status: {
      type: String,
      enum: ["generated", "proof_reading", "approved", "rejected", "pending", "in_progress"],
      required: true,
    },
    track: { type: String },
    type: { type: String, enum: Object.values(QuestionType), required: true, default: QuestionType.Choice },
    difficulty: { type: Number, min: 1, max: 5, required: true },
    requiredLanguages: { type: [String], required: true },
    audioId: { type: String },
    imageId: { type: String },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Author", required: false },
    tags: { type: [String], required: true },
    locales: { type: [LocaleSchema], required: true },
    isValid: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const QuestionModel = mongoose.model<IQuestion>("Question", QuestionSchema);
