import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.router";
import dotenv from "dotenv";
import { initRedis } from "./utils/redis";
dotenv.config();
const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json()); // Parses application/json
app.use(express.urlencoded({ extended: true }));
app.use("/auth", userRouter);

(async () => {
  // 1️⃣ Wait for Redis.
  await initRedis();

  // 2️⃣ Then start HTTP server.
  app.listen(3002, () => {
    console.log(`🚀 Server running on port ${3002}`);
  });
})();
