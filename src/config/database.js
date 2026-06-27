const { PrismaClient } = require("@prisma/client");
const config = require("./index");

const prisma = new PrismaClient({
  log:
    config.env === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL connected via Prisma");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = { prisma, connectDB };