const { PrismaClient } = require("@prisma/client");
const config = require("./index");
const { notificationEmitter, NOTIFICATION_EVENTS } = require("../api/events/notification.events");

const basePrisma = new PrismaClient({
  log:
    config.env === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Notification auto-triggers (Prisma Client Extension)
//
// Instead of adding `notificationEmitter.emit(...)` calls inside every service
// file, we hook straight into the Prisma client. Whenever an Enrollment row is
// created (or re-activated via upsert), ENROLLMENT_CREATED fires automatically.
// enrollments.service.js stays completely untouched — it just calls
// prisma.enrollment.create/upsert like normal and has no idea notifications
// exist. Add more model hooks here later (payment, assignmentSubmission,
// quizAttempt, certificate) once those modules are actually built.
// ─────────────────────────────────────────────────────────────────────────────
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
    process.exit(1);
  }
};

module.exports = { prisma, connectDB };