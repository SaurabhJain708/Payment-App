import { NextFunction, Request, Response } from "express";
import { initRedis } from "../utils/redis.js";
import { ApiError } from "../utils/Apierror.js";
import cookieSignature from "cookie-signature";

export const AuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies["connect.sid"];
    if (!token) {
      res.status(401).json({ message: "Unauthorized: No session token" });

      return;
    }

    const client = await initRedis();
    const unsignedToken = cookieSignature.unsign(
      token.slice(2),
      process.env.SESSION_SECRET!
    );

    if (!unsignedToken) {
      res.status(401).json({ message: "Invalid session signature" });
      return;
    }

    const redisKey = `sess:${unsignedToken}`;
    const sessionData = await client.get(redisKey);

    if (!sessionData) {
      res
        .status(401)
        .json({ message: "Session expired or not found in Redis" });
      return;
    }
    const session = JSON.parse(sessionData);
    if (!session.isVerified) {
      res.status(409).json({ message: "User not verified" });
      return;
    }
    if (!session.email || !session.id) {
      res.status(401).json({ message: "Unauthorized: No email found" });
      return;
    }
    req.sessionData = {
      userId: session.id as string,
      email: session.email as string,
      detailComplete: session.detailComplete as boolean,
      isVerified: session.isVerified as boolean,
    };
    next();
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json(new ApiError(500, "Internal server error in auth middleware"));
  }
};
