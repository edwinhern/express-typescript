export class GetDeepLUsageLogsDto {
  // readonly dateRange?: { startDate?: Date; endDate?: Date };
  startDate?: Date;
  endDate?: Date;
  readonly minCharacters?: number;
  readonly maxCharacters?: number;
  readonly page: number = 1;
  readonly limit: number = 10;
  sourceLanguage?: string;
  targetLanguage?: string;
}
