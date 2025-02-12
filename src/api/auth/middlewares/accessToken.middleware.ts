import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const accessTokenSecret = process.env.JWT_ACCESS_SECRET || "youraccesstokensecret";

export const accessTokenGuard = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.sendStatus(401); // Unauthorized
  }

  jwt.verify(token, accessTokenSecret, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Forbidden
    }
    const { sessionId } = user as { sessionId: string };

    req.user = { sessionId };
    next();
  });
};
