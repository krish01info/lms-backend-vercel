const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");
const { assertCourseOwnership } = require("./quizzes.service");

// ─── Shared field selections ─────────────────────────────────────────────────

const questionSelect = {
  id: true,
  quizId: true,
  text: true,
  options: true,
  answer: true,
  order: true,
};

// Same select but without the answer — used for student-facing responses.
const questionSelectSafe = {
  id: true,
  quizId: true,
  text: true,
  options: true,
  order: true,
};

// ─── Ownership helpers ───────────────────────────────────────────────────────

/**
 * Fetches a question by id, includes its parent quiz's courseId,
 * and asserts that the caller owns the course.
 * Used by updateQuestion / deleteQuestion.
 */
const fetchQuestionAndAssertOwnership = async (questionId, userId, role) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      quiz: { select: { id: true, courseId: true } },
    },
  });

  if (!question) throw new ApiError(404, "Question not found.");

  await assertCourseOwnership(question.quiz.courseId, userId, role);

  return question;
};

// ─── Service Methods ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/quizzes/:quizId/questions
 * Creates a new question on the given quiz.
 */
const createQuestion = async (quizId, { text, options, answer, order }, userId, role) => {
  // Verify quiz exists and caller owns the course.
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, courseId: true },
  });
  if (!quiz) throw new ApiError(404, "Quiz not found.");

  await assertCourseOwnership(quiz.courseId, userId, role);

  const question = await prisma.question.create({
    data: { quizId, text, options, answer, order },
    select: questionSelect,
  });

  return question;
};

/**
 * GET /api/v1/quizzes/:quizId/questions
 * Lists all questions for a quiz, ordered by `order`.
 *
 * Access rules:
 *  - STUDENT must be enrolled in the quiz's course.  The `answer` field
 *    is stripped from every question before returning.
 *  - INSTRUCTOR / ADMIN / SUPER_ADMIN see the full question (including answer).
 */
const getQuestions = async (quizId, userId, role) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, courseId: true },
  });
  if (!quiz) throw new ApiError(404, "Quiz not found.");

  const isStudent = role === ROLES.STUDENT;

  // Students must be enrolled.
  if (isStudent) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId: quiz.courseId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) {
      throw new ApiError(
        403,
        "Access denied. You are not enrolled in this course or your enrollment is not active."
      );
    }
  } else {
    // INSTRUCTOR / ADMIN must own the course (or have admin bypass)
    await assertCourseOwnership(quiz.courseId, userId, role);
  }

  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    select: isStudent ? questionSelectSafe : questionSelect,
  });

  return questions;
};

/**
 * PATCH /api/v1/questions/:id
 * Updates an existing question.  Validates that the final answer value
 * is present in the final options array (accounting for partial updates).
 */
const updateQuestion = async (id, data, userId, role) => {
  const question = await fetchQuestionAndAssertOwnership(id, userId, role);

  // Cross-validate answer ↔ options after merging with existing values.
  // Handles every partial-update combination:
  //   - only answer sent        → must be in existing options
  //   - only options sent       → existing answer must be in new options
  //   - both sent               → answer must be in new options
  //   - neither sent (text/order only) → no check needed
  const finalOptions = data.options !== undefined ? data.options : question.options;
  const finalAnswer = data.answer !== undefined ? data.answer : question.answer;

  if (!finalOptions.includes(finalAnswer)) {
    throw new ApiError(400, '"answer" must be one of the provided options.');
  }

  const updated = await prisma.question.update({
    where: { id },
    data: {
      ...(data.text !== undefined && { text: data.text }),
      ...(data.options !== undefined && { options: data.options }),
      ...(data.answer !== undefined && { answer: data.answer }),
      ...(data.order !== undefined && { order: data.order }),
    },
    select: questionSelect,
  });

  return updated;
};

/**
 * DELETE /api/v1/questions/:id
 * Removes a question.
 */
const deleteQuestion = async (id, userId, role) => {
  await fetchQuestionAndAssertOwnership(id, userId, role);

  await prisma.question.delete({ where: { id } });

  return { id };
};

module.exports = { createQuestion, getQuestions, updateQuestion, deleteQuestion };
