import type { ICategory } from "@/api/category/models/category.model";

const mongooseOld = require(require.resolve("mongoose-old", { paths: ["./mongoose-legacy/node_modules"] }));
const AutoIncrementID = require("mongoose-sequence")(mongooseOld);

const { Schema, model, Document, Model } = mongooseOld;

export type QuestionStatus = "generated" | "proof_reading" | "approved" | "rejected" | "pending" | "in_progress";

export interface IOldQuestionLocaleSchema {
  language: string;
  question: string;
  correct: string | [number, number] | number;
  wrong?: string[];
  isValid: boolean;
}

export enum QuestionType {
  Choice = "choice",
  Map = "map",
}

export interface IOldQuestion extends Document {
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
  locales: IOldQuestionLocaleSchema[];
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OldLocaleSchema = new Schema({
  language: { type: String, required: true },
  question: { type: String, required: true },
  correct: { type: Schema.Types.Mixed, required: true },
  wrong: { type: [String], default: [] },
  isValid: { type: Boolean, required: true },
});

const OldQuestionSchema = new Schema(
  {
    _id: { type: Number },
    categoryId: { type: Number, ref: "Category", required: true },
    status: {
      type: String,
      enum: ["generated", "proof_reading", "approved", "rejected", "pending", "in_progress"],
      required: true,
      default: "generated",
    },
    mainDbId: { type: Number, required: false },
    track: { type: String, required: false },
    type: { type: String, enum: Object.values(QuestionType), required: true, default: QuestionType.Choice },
    difficulty: { type: Number, min: 1, max: 5, required: true },
    requiredLanguages: { type: [String], required: true },
    audioId: { type: String, required: false },
    imageId: { type: String, required: false },
    authorId: { type: String, required: false },
    tags: { type: [String], required: true },
    locales: { type: [OldLocaleSchema], required: true },
    isValid: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// OldQuestionSchema.plugin(AutoIncrementID, { field: "_id", startAt: 1 });

export const OldQuestionModel: typeof Model = model("Question", OldQuestionSchema);
