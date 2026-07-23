const dotenv = require("dotenv");
dotenv.config();

const config = {
  // Server
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
  },

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  // AWS S3
  s3: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
  },

  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // AI Tutor / RAG
  ai: {
    groqApiKey: process.env.GROQ_API_KEY,
    jinaApiKey: process.env.JINA_API_KEY,
    chatModel: process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile",
    embeddingModel: process.env.JINA_EMBEDDING_MODEL || "jina-embeddings-v3",
  },

  // Email
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || "noreply@learnflow.com",
  },

  // Client
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};

// NOTE: We do NOT throw or process.exit() here anymore. This file is
// require()'d by nearly every module (including app.js) on every cold
// start. Throwing/exiting here kills the whole serverless function before
// Express can route ANY request - even brand new diagnostic routes that
// don't need these values at all. Instead we just record what's missing,
// so the app always boots, and code that actually needs a specific value
// (like connectDB) can check and fail gracefully on its own.
const required = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
}

config.missingEnvVars = missing;

module.exports = config;
