const express = require("express");
const router = express.Router();

const { protect, requireRole } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");
const {
  createQuizSchema,
  updateQuizSchema,
  quizIdParamSchema,
} = require("./quizzes.validation");
const {
  createQuiz,
  getQuizzes,
  getMyQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
} = require("./quizzes.controller");

router.get("/", protect, getQuizzes);
router.get("/my", protect, getMyQuizzes); // MUST be before /:id to avoid "my" being treated as an id
router.get("/:id", protect, validate(quizIdParamSchema, "params"), getQuizById);

router.post(
  "/",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(createQuizSchema),
  createQuiz
);

router.patch(
  "/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(quizIdParamSchema, "params"),
  validate(updateQuizSchema),
  updateQuiz
);

router.delete(
  "/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(quizIdParamSchema, "params"),
  deleteQuiz
);

module.exports = router;