import { logger } from "@/server";
import dotenv from "dotenv";
import mongoose from "mongoose";
const mongooseOld = require(require.resolve("mongoose-old", { paths: ["./mongoose-legacy/node_modules"] }));

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://admin:secret@localhost:27017/questionsDB";
const MONGO_URI_OLD = process.env.MONGO_URI_OLD;

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info("✅ MongoDB connected");
  } catch (error) {
    logger.fatal("❌ MongoDB connection error:", error);
    process.exit(1); // Exit process with failure
  }
};

export const connectMongoDBOld = async () => {
  try {
    await mongooseOld.connect(MONGO_URI_OLD, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info("✅ Old MongoDB connected");
  } catch (error) {
    logger.fatal(`❌ Old MongoDB connection error: ${error}`);
    process.exit(1); // Exit process with failure
  }
};
