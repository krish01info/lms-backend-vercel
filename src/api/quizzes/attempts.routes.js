const express = require("express");
const router = express.Router();

const { protect, requireRole } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");
const {
  submitAttemptSchema,
  quizIdParamSchema,
} = require("./attempts.validation");
const {
  submitAttempt,
  getMyAttempt,
  getAttemptsForQuiz,
} = require("./attempts.controller");

// ─── Student submits a quiz ─────────────────────────────────────────────────
// POST /api/v1/quizzes/:quizId/attempts
router.post(
  "/:quizId/attempts",
  protect,
  requireRole(ROLES.STUDENT),
  validate(quizIdParamSchema, "params"),
  validate(submitAttemptSchema),
  submitAttempt
);

// ─── Student views their own attempt ────────────────────────────────────────
// GET /api/v1/quizzes/:quizId/attempts/me
// NOTE: /me must be registered BEFORE the generic /:quizId/attempts route
//       to avoid Express treating "me" as a quizId.
router.get(
  "/:quizId/attempts/me",
  protect,
  requireRole(ROLES.STUDENT),
  validate(quizIdParamSchema, "params"),
  getMyAttempt
);

// ─── Instructor/Admin views all attempts (analytics) ────────────────────────
// GET /api/v1/quizzes/:quizId/attempts
router.get(
  "/:quizId/attempts",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(quizIdParamSchema, "params"),
  getAttemptsForQuiz
);

module.exports = router;
