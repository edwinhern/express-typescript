import type { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";
import { categoryService } from "./categoryService";
import type { GetCategoriesDto } from "./dto/get-categories.dto";

export class CategoryController {
  getCategories: RequestHandler = async (req: Request, res: Response) => {
    // return res.status(501).send("Not Implemented");
    const response = await categoryService.getCategories(req.query as GetCategoriesDto);

    handleServiceResponse(response, res);
  };

  syncCategories: RequestHandler = async (req: Request, res: Response) => {
    const response: ServiceResponse<null> = await categoryService.syncCategories();

    handleServiceResponse(response, res);
  };
}

export const categoryController = new CategoryController();
