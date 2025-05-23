import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.router";
import dotenv from "dotenv";
import { initRedis } from "./utils/redis";
import session from "express-session";
import { RedisStore } from "connect-redis";
dotenv.config();
const app = express();

(async () => {
  const client = await initRedis();
  app.use(
    session({
      store: new RedisStore({ client }),
      secret: "your_secret_key", // replace with a strong secret
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // set true if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      },
    })
  );

  app.use(cors());
  app.use(cookieParser());
  app.use(express.json()); // Parses application/json
  app.use(express.urlencoded({ extended: true }));
  app.use("/auth", userRouter);

  app.listen(3002, () => {
    console.log(`🚀 Server running on port ${3002}`);
  });
})();
