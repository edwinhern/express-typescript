import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import type { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { StatusCodes } from "http-status-codes";
import { CategoryModel as CategoryModelNew, type ICategory } from "../question/models/category.model";
import { translationService } from "../translation/translationService";
import type { CreateCategoryDto } from "./dto/create-category.dto";
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

  async getCategoryById(categoryId: string): Promise<ServiceResponse<ICategory | null>> {
    try {
      logger.info(`🔍 Fetching category with ID: ${categoryId}`);

      const category = await CategoryModelNew.findById(categoryId).lean();

      if (!category) {
        logger.warn(`⚠️ Category with ID: ${categoryId} not found.`);
        return ServiceResponse.failure("Category not found.", null, StatusCodes.NOT_FOUND);
      }

      logger.info(`✅ Fetched category with ID: ${categoryId} successfully.`);
      return ServiceResponse.success("Category fetched successfully.", category);
    } catch (error) {
      logger.error(`❌ Error fetching category with ID: ${categoryId}: ${error}`);
      return ServiceResponse.failure("Error fetching category.", null, StatusCodes.INTERNAL_SERVER_ERROR);
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
  async createCategory(categoryData: CreateCategoryDto): Promise<ServiceResponse<null>> {
    try {
      const { name, parentId, locales } = categoryData;

      // Проверка на уникальность по имени
      const [existingCategoryNew, existingCategoryOld] = await Promise.all([
        CategoryModelNew.findOne({ name }),
        CategoryModelOld.findOne({ name }),
      ]);
      if (existingCategoryNew || existingCategoryOld) {
        logger.error("❌ Category with this name already exists.");
        return ServiceResponse.failure("Category with this name already exists.", null, 400);
      }

      // Получаем родительскую категорию
      const existingParentCategoryNew = parentId ? await CategoryModelNew.findById(parentId).lean() : null;

      const ancestors = parentId ? [...(existingParentCategoryNew?.ancestors ?? []), parentId] : [];

      const generatedId = Date.now(); // Один id на обе категории

      // Создаём новые документы
      const newCategory = new CategoryModelNew({
        _id: generatedId,
        name,
        parentId: parentId ?? null,
        ancestors,
        locales,
      });

      const oldCategory = new CategoryModelOld({
        _id: generatedId,
        name,
        parentId: parentId ?? null,
        ancestors,
        locales,
      });

      // Сохраняем в базу
      await Promise.all([newCategory.save(), oldCategory.save()]);

      logger.info("🗂️ Category saved to the database.");
      return ServiceResponse.success("Category created successfully.", null);
    } catch (error) {
      logger.error(`❌ Error creating category: ${error}`);
      return ServiceResponse.failure("Error creating category.", null, 500);
    }
  }

  async updateCategory(categoryId: string, categoryData: Partial<CreateCategoryDto>): Promise<ServiceResponse<null>> {
    try {
      const { name, locales } = categoryData;
      const updateData: Partial<ICategory> = {};
      if (name) updateData.name = name;
      if (locales) updateData.locales = locales;
      //TODO: add parentId and ancestors handling

      const [existingCategoryNew, existingCategoryOld] = await Promise.all([
        CategoryModelNew.findOne({ name }),
        CategoryModelOld.findOne({ name }),
      ]);
      if (existingCategoryNew || existingCategoryOld) {
        logger.error("❌ Category with this name already exists.");
        return ServiceResponse.failure("Category with this name already exists.", null, 400);
      }

      await Promise.all([
        CategoryModelNew.findByIdAndUpdate(categoryId, updateData),
        CategoryModelOld.findByIdAndUpdate(categoryId, updateData),
      ]);

      logger.info("✅ Category updated successfully.");
      return ServiceResponse.success("Category updated successfully.", null);
    } catch (error) {
      logger.error("❌ Error updating category:", error);
      return ServiceResponse.failure("Error updating category.", null, 500);
    }
  }

  async deleteCategory(categoryId: string): Promise<ServiceResponse<null>> {
    try {
      const hasChildren = await CategoryModelNew.exists({ parentId: Number(categoryId) });

      if (hasChildren) {
        logger.warn("⚠️ Cannot delete category with subcategories.");
        return ServiceResponse.failure("Cannot delete category with subcategories.", null, 400);
      }

      await Promise.all([
        CategoryModelNew.findByIdAndDelete(categoryId),
        CategoryModelOld.findByIdAndDelete(categoryId),
      ]);

      logger.info("🗑️ Category deleted successfully.");
      return ServiceResponse.success("Category deleted successfully.", null);
    } catch (error) {
      logger.error("❌ Error deleting category:", error);
      return ServiceResponse.failure("Error deleting category.", null, 500);
    }
  }

  async translateCategory(
    requiredLocales: string[],
    sourceLanguage: string,
    originalText: string,
  ): Promise<
    ServiceResponse<
      | {
          language: string;
          value: string;
        }[]
      | null
    >
  > {
    try {
      const translationsPromises = Promise.all(
        requiredLocales.map(async (locale) => {
          const translation = await translationService.translateText(
            originalText,
            // sourceLanguage.toUpperCase() as SourceLanguageCode,
            // sourceLanguage === "en"
            //   ? ("EN-US" as SourceLanguageCode)
            //   : (sourceLanguage.toUpperCase() as SourceLanguageCode),
            sourceLanguage === "en" ? ("en-GB" as SourceLanguageCode) : (sourceLanguage as SourceLanguageCode),
            locale as TargetLanguageCode,
          );
          if (!translation) {
            logger.error(`❌ Translation failed for locale: ${locale}`);
            return null;
          }
          return {
            language: locale,
            value: translation,
          };
        }),
      );
      const translatedLocales = await translationsPromises;
      const filteredLocales = translatedLocales.filter((locale) => locale !== null);
      if (filteredLocales.length === 0) {
        logger.error("❌ No translations found.");
        return ServiceResponse.failure("No translations found.", null, 404);
      }

      return ServiceResponse.success("Category translated successfully.", filteredLocales);
    } catch (error) {
      logger.error(`❌ Error translating category: ${error}`);
      return ServiceResponse.failure("Error translating category.", null, 500);
    }
  }
}

export const categoryService = new CategoryService();
