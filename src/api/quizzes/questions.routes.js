const express = require("express");
const router = express.Router();

const { protect, requireRole } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");
const {
  createQuestionSchema,
  updateQuestionSchema,
  quizIdParamSchema,
  questionIdParamSchema,
} = require("./questions.validation");
const {
  createQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
} = require("./questions.controller");

// ─── Quiz-level routes (mounted at /api/v1) ──────────────────────────────────
// POST /api/v1/quizzes/:quizId/questions
router.post(
  "/quizzes/:quizId/questions",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(quizIdParamSchema, "params"),
  validate(createQuestionSchema),
  createQuestion
);

// GET /api/v1/quizzes/:quizId/questions
router.get(
  "/quizzes/:quizId/questions",
  protect,
  validate(quizIdParamSchema, "params"),
  getQuestions
);

// ─── Question-level routes (mounted at /api/v1) ──────────────────────────────
// PATCH /api/v1/questions/:id
router.patch(
  "/questions/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(questionIdParamSchema, "params"),
  validate(updateQuestionSchema),
  updateQuestion
);

// DELETE /api/v1/questions/:id
router.delete(
  "/questions/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(questionIdParamSchema, "params"),
  deleteQuestion
);

module.exports = router;
