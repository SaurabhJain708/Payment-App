import { NextFunction, Request, Response } from "express";
import { initRedis } from "../utils/redis";
import { ApiError } from "../utils/Apierror";
import cookieSignature from "cookie-signature";

export async function AuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const SESSION_SECRET = "your-session-secret"; // Same as used in express-session

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
      SESSION_SECRET
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
    };
    next();
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error in auth middleware"));
  }
}
