import { NextFunction, Request, Response } from "express";
import { initRedis } from "../utils/redis.js";
import { ApiError } from "../utils/Apierror.js";
import cookieSignature from "cookie-signature";

export async function AuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {

  try {
    const token = req.cookies["connect.sid"];
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No session token" });
    }

    const client = await initRedis();
    const unsignedToken = cookieSignature.unsign(
      token.slice(2),
      process.env.SESSION_SECRET!
    );

    if (!unsignedToken) {
      return res.status(401).json({ message: "Invalid session signature" });
    }

    const redisKey = `sess:${unsignedToken}`;
    const sessionData = await client.get(redisKey);

    if (!sessionData) {
      return res
        .status(401)
        .json({ message: "Session expired or not found in Redis" });
    }
    const session = JSON.parse(sessionData);
    if (!session.isVerified) {
      return res.status(409).json({ message: "User not verified" });
    }
    if (!session.email || !session.id) {
      return res.status(401).json({ message: "Unauthorized: No email found" });
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
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error in auth middleware"));
  }
}
