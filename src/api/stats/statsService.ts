import { ServiceResponse } from "@/common/models/serviceResponse";
import type mongoose from "mongoose";
import { DeepLUsageLogModel, type IDeepLUsageLog } from "./models/deeplUsageLog.model";
import { type IQuestionGenerationLog, QuestionGenerationLogModel } from "./models/questionGenerationLog.model";
export class StatsService {
  //#region OpenAI Usage Logs
  async logQuestionGeneration(
    categoryId: mongoose.Types.ObjectId,
    questionIds: mongoose.Types.ObjectId[],
    tokensUsed: number,
    requestPrompt: string,
  ) {
    return await QuestionGenerationLogModel.create({
      categoryId,
      questionIds,
      tokensUsed,
      requestPrompt,
    });
  }

  async getOpenAiUsageLogs(
    dateRange?: { from?: Date; to?: Date },
    minTokens?: number,
    maxTokens?: number,
  ): Promise<ServiceResponse<IQuestionGenerationLog[]>> {
    const query: any = {};

    if (dateRange?.from || dateRange?.to) {
      query.createdAt = {};
      if (dateRange.from) query.createdAt.$gte = dateRange.from;
      if (dateRange.to) query.createdAt.$lte = dateRange.to;
    }

    if (minTokens !== undefined) {
      query.tokensUsed = { ...query.tokensUsed, $gte: minTokens };
    }

    if (maxTokens !== undefined) {
      query.tokensUsed = { ...query.tokensUsed, $lte: maxTokens };
    }

    const logs = await QuestionGenerationLogModel.find(query).populate("questionIds").sort({ createdAt: -1 });

    return ServiceResponse.success("Logs found", logs);
  }

  async getOpenAiTokenUsageStats(): Promise<ServiceResponse<{ totalTokens: number; totalRequests: number }>> {
    const logs = await QuestionGenerationLogModel.aggregate([
      {
        $group: {
          _id: null,
          totalTokens: { $sum: "$tokensUsed" },
          totalRequests: { $sum: 1 },
        },
      },
    ]);

    return ServiceResponse.success(
      "Token usage stats found",
      logs.length > 0 ? logs[0] : { totalTokens: 0, totalRequests: 0 },
    );
  }

  async clearOpenAiLogs(): Promise<ServiceResponse<null>> {
    await QuestionGenerationLogModel.deleteMany({});

    return ServiceResponse.success("Logs cleared", null);
  }
  //#endregion

  //#region DeepL Usage Logs
  async logDeepLUsage(
    questionId: mongoose.Types.ObjectId,
    charactersUsed: number,
    sourceLanguage: string,
    targetLanguage: string,
    requestText: string,
  ) {
    return await DeepLUsageLogModel.create({
      questionId,
      charactersUsed,
      sourceLanguage,
      targetLanguage,
      requestText,
    });
  }

  async getDeepLUsageLogs(
    dateRange?: { from?: Date; to?: Date },
    minCharacters?: number,
    maxCharacters?: number,
  ): Promise<ServiceResponse<IDeepLUsageLog[]>> {
    const query: any = {};

    if (dateRange?.from || dateRange?.to) {
      query.createdAt = {};
      if (dateRange.from) query.createdAt.$gte = dateRange.from;
      if (dateRange.to) query.createdAt.$lte = dateRange.to;
    }

    if (minCharacters !== undefined) {
      query.charactersUsed = { ...query.charactersUsed, $gte: minCharacters };
    }

    if (maxCharacters !== undefined) {
      query.charactersUsed = { ...query.charactersUsed, $lte: maxCharacters };
    }

    const logs = await DeepLUsageLogModel.find(query).sort({ createdAt: -1 });

    return ServiceResponse.success("Logs found", logs);
  }

  async getDeepLUsageStats(): Promise<ServiceResponse<{ totalCharacters: number; totalRequests: number }>> {
    const logs = await DeepLUsageLogModel.aggregate([
      {
        $group: {
          _id: null,
          totalCharacters: { $sum: "$charactersUsed" },
          totalRequests: { $sum: 1 },
        },
      },
    ]);

    return ServiceResponse.success(
      "DeepL usage stats found",
      logs.length > 0 ? logs[0] : { totalCharacters: 0, totalRequests: 0 },
    );
  }

  async clearDeepLLogs(): Promise<ServiceResponse<null>> {
    await DeepLUsageLogModel.deleteMany({});

    return ServiceResponse.success("Logs cleared", null);
  }
  //#endregion
}

export const statsService = new StatsService();
