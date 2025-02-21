import mongoose, { Schema, type Document } from "mongoose";

export interface ICategoryLocaleSchema {
  language: string;
  name: string;
}

export interface ICategory extends Document {
  name: string;
  parent: ICategory | null;
  locales: ICategoryLocaleSchema[];
}

const CategoryLocaleSchema = new Schema<ICategoryLocaleSchema>({
  language: { type: String, required: true },
  name: { type: String, required: true },
});

export const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  locales: { type: [CategoryLocaleSchema], required: true, default: [] },
});

export const CategoryModel = mongoose.model<ICategory>("Category", CategorySchema);
