const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const passport = require("./config/passport");
const path = require("path");
const config = require("./config");

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes        = require("./api/auth/auth.routes");
const { router: userRoutes, studentRouter } = require("./api/users/users.routes");
const courseRoutes      = require("./api/courses/courses.routes");
const enrollmentRoutes  = require("./api/enrollments/enrollments.routes");
const lessonRoutes      = require("./api/lessons/lessons.routes");
const assignmentRoutes  = require("./api/assignments/assignments.routes");
const uploadRoutes      = require("./api/uploads/uploads.routes");
const quizRoutes        = require("./api/quizzes/quizzes.routes");
const attemptRoutes     = require("./api/quizzes/attempts.routes");
const questionsRoutes   = require("./api/quizzes/questions.routes");
const progressRoutes    = require("./api/progress/progress.routes");
const certificateRoutes = require("./api/certificates/certificates.routes");
const attendanceRoutes  = require("./api/attendance/attendance.routes");
const gradebookRoutes   = require("./api/gradebook/gradebook.routes");
const notificationRoutes  = require("./api/notifications/notifications.routes");
const announcementRoutes  = require("./api/announcements/announcements.routes");
const messageRoutes       = require("./api/messages/messages.routes");
const paymentRoutes       = require("./api/payments/payments.routes");
const activityRoutes      = require("./api/activity/activity.routes");
const aiTutorRoutes       = require("./api/ai-tutor/aiTutor.routes");
const parentRoutes        = require("./api/parent/parent.routes");


const app = express();

app.use(passport.initialize());

// ─── Security & Compression ───────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.endsWith(".vercel.app") || origin.endsWith(".render.com")) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(compression());

// ─── Logging ──────────────────────────────────────────────────────────────────
if (config.env !== "test") {
  app.use(morgan("dev"));
}

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ─── Static: local dev uploads ────────────────────────────────────────────────
if (config.env === "development") {
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", env: config.env, timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = "/api/v1";

app.use(`${API}/auth`,         authRoutes);
app.use(`${API}/users`,        userRoutes);        // GET|PATCH /users/me, avatar, parent-code
app.use(`${API}/users`,        studentRouter);     // GET /users/link-requests, POST /users/link-requests/:id/respond
app.use(`${API}/courses`,      courseRoutes);
app.use(`${API}/enrollments`,  enrollmentRoutes);
app.use(`${API}/courses/:courseId/lessons`, lessonRoutes);
app.use(`${API}/assignments`,  assignmentRoutes);
app.use(`${API}/uploads`,      uploadRoutes);
app.use(`${API}`,              questionsRoutes);
app.use(`${API}/quizzes`,      quizRoutes);
app.use(`${API}/quizzes`,      attemptRoutes);
app.use(`${API}/progress`,     progressRoutes);
app.use(`${API}/certificates`, certificateRoutes);
app.use(`${API}/attendance`,   attendanceRoutes);
app.use(`${API}/gradebook`,    gradebookRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/announcements`, announcementRoutes);
app.use(`${API}/messages`,      messageRoutes);
app.use(`${API}/payments`,      paymentRoutes);
app.use(`${API}/activity`,      activityRoutes);
app.use(`${API}/ai-tutor`,      aiTutorRoutes);
app.use(`${API}/parent`,        parentRoutes);


// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, statusCode: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    statusCode,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = app;