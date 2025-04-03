import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import { StatusCodes } from "http-status-codes";
import { CategoryModel as CategoryModelNew, type ICategory } from "../question/models/category.model";
import type { GetCategoriesDto } from "./dto/get-categories.dto";
import { CategoryModel as CategoryModelOld } from "./models/category.model";

export class CategoryService {
  async getCategories(getCategoriesDto: GetCategoriesDto): Promise<
    ServiceResponse<{
      categories: ICategory[];
      categoriesCount: number;
      totalPages: number;
    } | null>
  > {
    try {
      logger.info("🔍 Fetching categories...");
      const { limit = 10, page = 1, title } = getCategoriesDto;

      const validLimit = !limit || limit <= 0 || Number.isNaN(Number(limit)) ? 10 : limit;
      const validPage = !page || page <= 0 || Number.isNaN(Number(page)) ? 1 : page;

      const query: any = {};
      if (title) {
        query.$or = [
          { name: { $regex: new RegExp(title, "i") } },
          { "locales.value": { $regex: new RegExp(title, "i") } },
        ];
      }

      const [categories, categoriesCount] = await Promise.all([
        CategoryModelNew.find(query)
          .limit(validLimit)
          .skip((validPage - 1) * validLimit)
          .lean(),
        CategoryModelNew.countDocuments(query),
      ]);

      const totalPages = categoriesCount > 0 ? Math.ceil(categoriesCount / validLimit) : 1;

      logger.info(`✅ Fetched ${categories.length} categories successfully!`);

      return ServiceResponse.success("Categories fetched successfully.", { categories, categoriesCount, totalPages });
    } catch (error) {
      logger.error(`❌ Error fetching categories: ${error}`);
      return ServiceResponse.failure("Failed to fetch categories", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async syncCategories(): Promise<ServiceResponse<null>> {
    try {
      logger.info("🔄 Syncing categories from old DB to new DB...");

      // Получаем все категории из старой БД
      const oldCategories = await CategoryModelOld.find().lean();

      if (!oldCategories.length) {
        logger.info("✅ No categories to sync.");
        return ServiceResponse.failure("No categories to sync.", null, 404);
      }

      // Создаём массив новых категорий
      const newCategories = oldCategories.map(({ _id, ...rest }: { _id: number; [key: string]: any }) => ({
        ...rest,
        _id, // Сохраняем старый `_id`
      }));

      // Удаляем существующие записи с такими же `_id`
      await CategoryModelNew.deleteMany({ _id: { $in: oldCategories.map((c: { _id: number }) => c._id) } });

      // Вставляем новые данные
      await CategoryModelNew.insertMany(newCategories);

      logger.info(`✅ Synced ${newCategories.length} categories successfully!`);

      return ServiceResponse.success("Categories synced successfully.", null);
    } catch (error) {
      logger.error("❌ Error during category sync:", error);

      return ServiceResponse.failure("Error during category sync.", null, 500);
    }
  }

  async clearCache(categoryId: string): Promise<ServiceResponse<null>> {
    try {
      const cacheKey = `openai:response:${categoryId}`;
      logger.info(`🗑️ Clearing cache for category ID: ${categoryId}`);

      await redisClient.del(cacheKey);

      logger.info(`✅ Cache cleared for category ID: ${categoryId}`);
      return ServiceResponse.success("Cache cleared successfully.", null);
    } catch (error) {
      logger.error("❌ Error clearing cache:", error);
      return ServiceResponse.failure("Error clearing cache.", null, 500);
    }
  }
}

export const categoryService = new CategoryService();
