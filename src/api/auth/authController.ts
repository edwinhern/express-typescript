import { authService } from "@/api/auth/authService";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import type { Request, RequestHandler, Response } from "express";

class AuthController {
  public login: RequestHandler = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const serviceResponse = await authService.login(username, password);

    return handleServiceResponse(serviceResponse, res);
  };

  async refresh(req: Request, res: Response) {
    const sessionId: string = req?.user?.sessionId as string;
    const serviceResponse = await authService.refreshTokens(sessionId);

    return handleServiceResponse(serviceResponse, res);
  }

  me: RequestHandler = async (req: Request, res: Response) => {
    const sessionId: string = req?.user?.sessionId as string;
    const serviceResponse = await authService.getCurrentUser(sessionId);

    return handleServiceResponse(serviceResponse, res);
  };
}

export const authController = new AuthController();
