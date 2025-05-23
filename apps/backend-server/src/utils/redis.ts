// src/index.ts
import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

redisClient.on("error", err => {
  console.error("Redis error:", err);
});

export async function initRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected");
  }
  return redisClient;
}

export default redisClient;
