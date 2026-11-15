
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Always load .env from the project root:
// C:\intellmeet\.env
const envPath = fileURLToPath(
  new URL("../../.env", import.meta.url)
);

dotenv.config({ path: envPath });

// Application configuration
export const config = {
  // Server
  port: Number(process.env.PORT || 5000),

  // Frontend URL
  clientUrl: process.env.CLIENT_URL || "http://localhost:5174",

  // MongoDB
  mongoUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/intellmeet",

  // JWT authentication
  jwtSecret:
    process.env.JWT_SECRET ||
    "development-only-change-this-secret",

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",

  // OpenAI
  openAiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",

  // Environment
  nodeEnv: process.env.NODE_ENV || "development"
};

// Validate production configuration
if (
  config.nodeEnv === "production" &&
  config.jwtSecret === "development-only-change-this-secret"
) {
  throw new Error(
    "Set a strong JWT_SECRET in production."
  );
}

// Validate frontend URL
if (!/^https?:\/\//.test(config.clientUrl)) {
  throw new Error("Invalid CLIENT_URL configuration.");
}
