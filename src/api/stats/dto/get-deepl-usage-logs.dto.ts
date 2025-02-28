export class GetDeepLUsageLogsDto {
  readonly dateRange?: { from?: Date; to?: Date };
  readonly minCharacters?: number;
  readonly maxCharacters?: number;
  readonly page: number = 1;
  readonly limit: number = 10;
}
