import { logger } from "@/server";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://admin:secret@localhost:27017/questionsDB";

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info("✅ MongoDB connected");
  } catch (error) {
    logger.fatal("❌ MongoDB connection error:", error);
    process.exit(1); // Exit process with failure
  }
};
