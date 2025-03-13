// export const CategoryModel = mongoose.model<ICategory>("Category", CategorySchema);
import mongoose, { Schema, type Document } from "mongoose";
const AutoIncrementID = require("mongoose-sequence")(mongoose);

export interface ICategoryLocaleSchema {
  language: string;
  value: string;
}

export interface ICategory extends Document {
  _id: number;
  name: string;
  parentId: number | null;
  ancestors: number[];
  hash?: string;
  locales: ICategoryLocaleSchema[];
}

const CategoryLocaleSchema = new Schema<ICategoryLocaleSchema>({
  language: { type: String, required: true },
  value: { type: String, required: true },
});

export const CategorySchema = new Schema<ICategory>({
  _id: { type: Number },
  name: { type: String, required: true },
  parentId: { type: Number, ref: "Category", default: null },
  ancestors: { type: [Number], default: [] },
  hash: { type: String, required: false },
  locales: { type: [CategoryLocaleSchema], required: true, default: [] },
});

// 🔥 Включаем автоинкремент `_id`
// CategorySchema.plugin(AutoIncrementID, { field: "_id", startAt: 1 });

export const CategoryModel = mongoose.model<ICategory>("Category", CategorySchema);
