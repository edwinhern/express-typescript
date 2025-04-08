export interface CreateCategoryDto {
  name: string;
  parentId?: string;
  // ancestors?: string[];
  locales?: { language: string; value: string }[];
}
