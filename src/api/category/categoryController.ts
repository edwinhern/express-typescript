import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import type { ICategory } from "../question/models/category.model";
import { categoryService } from "./categoryService";
import type { GetCategoriesDto } from "./dto/get-categories.dto";

export class CategoryController {
  getCategories: RequestHandler = async (req: Request, res: Response) => {
    const response = await categoryService.getCategories(req.query as GetCategoriesDto);

    handleServiceResponse(response, res);
  };

  getCategoryById: RequestHandler = async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const response: ServiceResponse<ICategory | null> = await categoryService.getCategoryById(categoryId);

    handleServiceResponse(response, res);
  };

  syncCategories: RequestHandler = async (req: Request, res: Response) => {
    const response: ServiceResponse<null> = await categoryService.syncCategories();

    handleServiceResponse(response, res);
  };

  clearCache: RequestHandler = async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const response: ServiceResponse<null> = await categoryService.clearCache(categoryId);
    handleServiceResponse(response, res);
  };

  createCategory: RequestHandler = async (req: Request, res: Response) => {
    const response: ServiceResponse<null> = await categoryService.createCategory(req.body);
    handleServiceResponse(response, res);
  };

  async updateCategory(req: Request, res: Response) {
    const { categoryId } = req.params;
    const response: ServiceResponse<null> = await categoryService.updateCategory(categoryId, req.body);
    handleServiceResponse(response, res);
  }
  async deleteCategory(req: Request, res: Response) {
    const { categoryId } = req.params;
    const response: ServiceResponse<null> = await categoryService.deleteCategory(categoryId);
    handleServiceResponse(response, res);
  }

  async translateCategory(req: Request, res: Response) {
    // const { categoryId } = req.params;
    const { requiredLocales, originalText, sourceLanguage } = req.body;

    const response = await categoryService.translateCategory(requiredLocales, sourceLanguage, originalText);

    handleServiceResponse(response, res);
  }

  async getCategoriesWithQuestionsCount(req: Request, res: Response) {
    const response: ServiceResponse<{
      categories: (ICategory & { questionsCount: number })[];
      categoriesCount: number;
    } | null> = await categoryService.getCategoriesWithQuestionsCount();

    handleServiceResponse(response, res);
  }
}

export const categoryController = new CategoryController();
