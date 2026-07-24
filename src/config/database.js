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

    // A new lesson is created -> notify every enrolled student.
    lesson: {
      async create({ args, query }) {
        const result = await query(args);
        notificationEmitter.emit(NOTIFICATION_EVENTS.LESSON_PUBLISHED, {
          courseId: args.data.courseId,
          lessonId: result?.id,
          lessonTitle: args.data.title,
        });
        return result;
      },
    },

    assignmentSubmission: {
      // Student submits (or resubmits) an assignment -> notify the instructor.
      async upsert({ args, query }) {
        const result = await query(args);
        const key = args.where?.userId_assignmentId;
        if (key) {
          notificationEmitter.emit(NOTIFICATION_EVENTS.ASSIGNMENT_SUBMITTED, {
            assignmentId: key.assignmentId,
            studentId: key.userId,
          });
        }
        return result;
      },
      // Instructor grades a submission -> notify the student.
      async update({ args, query }) {
        const result = await query(args);
        if (args.data && args.data.grade !== undefined) {
          notificationEmitter.emit(NOTIFICATION_EVENTS.ASSIGNMENT_GRADED, {
            submissionId: result.id,
            studentId: result.userId,
            assignmentId: result.assignmentId,
            grade: result.grade,
          });
        }
        return result;
      },
    },

    // Quiz auto-graded on submit -> notify the student.
    quizAttempt: {
      async create({ args, query }) {
        const result = await query(args);
        notificationEmitter.emit(NOTIFICATION_EVENTS.QUIZ_GRADED, {
          userId: args.data.userId,
          quizId: args.data.quizId,
          score: args.data.score,
          passed: args.data.passed,
        });
        return result;
      },
    },

    // Certificate issued (or re-issued) -> notify the student.
    certificate: {
      async upsert({ args, query }) {
        const result = await query(args);
        const key = args.where?.userId_courseId;
        if (key) {
          notificationEmitter.emit(NOTIFICATION_EVENTS.CERTIFICATE_ISSUED, {
            userId: key.userId,
            courseId: key.courseId,
            certificateId: result?.id,
          });
        }
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