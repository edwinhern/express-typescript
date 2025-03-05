import mongoose, { Schema, type Document } from "mongoose";

export interface IDeepLUsageLog extends Document {
  // questionId: mongoose.Types.ObjectId;
  charactersUsed: number;
  sourceLanguage: string;
  targetLanguage: string;
  requestText: string;
  translatedText: string;
  createdAt: Date;
}

const DeepLUsageLogSchema = new Schema<IDeepLUsageLog>(
  {
    // questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    charactersUsed: { type: Number, required: true },
    sourceLanguage: { type: String, required: true },
    targetLanguage: { type: String, required: true },
    requestText: { type: String, required: true },
    translatedText: { type: String },
  },
  { timestamps: true },
);

export const DeepLUsageLogModel = mongoose.model<IDeepLUsageLog>("DeepLUsageLog", DeepLUsageLogSchema);
