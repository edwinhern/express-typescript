import { logger } from "@/server";
import dotenv from "dotenv";
import { createClient } from "redis";

dotenv.config();

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    logger.info("✅ Redis connection successful");
  } catch (error) {
    logger.info("❌ Redis connection failed:", error);
  }
};

export { redisClient };
