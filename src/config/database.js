const { PrismaClient } = require("@prisma/client");
const config = require("./index");
const { notificationEmitter, NOTIFICATION_EVENTS } = require("../api/events/notification.events");

const basePrisma = new PrismaClient({
  log:
    config.env === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

const prisma = basePrisma.$extends({
  name: "notification-triggers",
  query: {
    enrollment: {
      async create({ args, query }) {
        const result = await query(args);
        notificationEmitter.emit(NOTIFICATION_EVENTS.ENROLLMENT_CREATED, {
          studentId: result.userId,
          courseId: result.courseId,
        });
        return result;
      },
      async upsert({ args, query }) {
        const result = await query(args);
        notificationEmitter.emit(NOTIFICATION_EVENTS.ENROLLMENT_CREATED, {
          studentId: result.userId,
          courseId: result.courseId,
        });
        return result;
      },
    },
  },
});

const connectDB = async () => {
  try {
    await basePrisma.$connect();
    console.log("✅ PostgreSQL connected via Prisma");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    // NOTE: process.exit(1) is intentionally NOT used here. connectDB() is
    // called lazily on every cold start inside api/index.js's own
    // try/catch middleware. process.exit() terminates the whole serverless
    // function immediately - it does NOT let that outer try/catch run,
    // so the request would just die as FUNCTION_INVOCATION_FAILED instead
    // of getting the clean "Database connection failed" JSON response
    // api/index.js is designed to send. Re-throwing lets the caller handle it.
    throw error;
  }
};

module.exports = { prisma, connectDB };