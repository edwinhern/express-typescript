import { ServiceResponse } from "@/common/models/serviceResponse";
import { redisClient } from "@/common/utils/redisClient";
import { logger } from "@/server";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { StatusCodes } from "http-status-codes";
import jwt, { type SignOptions } from "jsonwebtoken";

dotenv.config();

const rootUserLogin = process.env.ROOT_USER_LOGIN || "admin";
const rootUserPassword = process.env.ROOT_USER_PASSWORD || "password";
const hashedPassword = bcrypt.hashSync(rootUserPassword, 10);

const jwtAccessSecret: jwt.Secret = process.env.JWT_ACCESS_SECRET!;
const jwtRefreshSecret: jwt.Secret = process.env.JWT_REFRESH_SECRET!;

const jwtAccessExpiration = process.env.JWT_ACCESS_EXPIRATION || "1h";
const jwtRefreshExpiration = process.env.JWT_REFRESH_EXPIRATION || "7d";

export class AuthService {
  async login(
    login: string,
    password: string,
  ): Promise<
    ServiceResponse<{
      accessToken: string;
      refreshToken: string;
    } | null>
  > {
    if (login === rootUserLogin && bcrypt.compareSync(password, hashedPassword)) {
      const sessionId = new Date().getTime().toString();
      // const token = jwt.sign({ login, sessionId}, jwtSecret, { expiresIn: '1h' });
      const { accessToken, refreshToken } = await this.generateTokens(sessionId);

      await redisClient.set(
        `session:${sessionId}`,
        JSON.stringify({
          sessionId,
          refreshToken,
          context: [],
        }),
        { EX: 3600 },
      );

      logger.info(`Admin logged in: ${login}`);

      return ServiceResponse.success("Login successful", {
        accessToken,
        refreshToken,
      });
    }
    return ServiceResponse.failure("Invalid login or password", null, StatusCodes.UNAUTHORIZED);
  }

  async generateTokens(sessionId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = jwt.sign({ sessionId }, jwtAccessSecret, {
      expiresIn: jwtAccessExpiration as SignOptions["expiresIn"],
    });
    const refreshToken = jwt.sign({ sessionId }, jwtRefreshSecret, {
      expiresIn: jwtRefreshExpiration as SignOptions["expiresIn"],
    });

    return { accessToken, refreshToken };
  }

  async getCurrentUser(sessionId: string): Promise<
    ServiceResponse<{
      sessionId: string;
    } | null>
  > {
    const sessionData = await redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      return ServiceResponse.failure("Session not found", null, StatusCodes.UNAUTHORIZED);
    }

    return ServiceResponse.success("Success", {
      sessionId,
      context: JSON.parse(sessionData).context,
    });
  }

  async refreshTokens(sessionId: string): Promise<
    ServiceResponse<{
      accessToken: string;
      refreshToken: string;
    } | null>
  > {
    const sessionData = await redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      return ServiceResponse.failure("Session not found", null, StatusCodes.UNAUTHORIZED);
    }

    const { refreshToken } = JSON.parse(sessionData);

    try {
      jwt.verify(refreshToken, jwtRefreshSecret);

      const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(sessionId);

      await redisClient.set(
        `session:${sessionId}`,
        JSON.stringify({
          sessionId,
          refreshToken: newRefreshToken,
          context: JSON.parse(sessionData).context,
        }),
        { EX: 3600 },
      );

      return ServiceResponse.success("Token refreshed", {
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      return ServiceResponse.failure("Invalid token", null, StatusCodes.FORBIDDEN);
    }
  }
}

export const authService = new AuthService();
