const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");
const { assertCourseOwnership } = require("./quizzes.service");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetches the quiz with its questions and course info.
 * Throws 404 if the quiz doesn't exist.
 */
const fetchQuizWithQuestions = async (quizId) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      courseId: true,
      passMark: true,
      status: true,
      questions: {
        select: { id: true, text: true, options: true, answer: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!quiz) throw new ApiError(404, "Quiz not found.");
  return quiz;
};

/**
 * Verifies the student has an ACTIVE enrollment in the given course.
 * Throws 403 if not enrolled.
 */
const assertEnrolled = async (userId, courseId) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId, status: "ACTIVE" },
    select: { id: true },
  });

  if (!enrollment) {
    throw new ApiError(
      403,
      "Access denied. You are not enrolled in this course or your enrollment is not active."
    );
  }
};

/**
 * Builds the per-question breakdown array used by both submit and get-my-attempt.
 * `questions` — the authoritative list from the DB.
 * `rawAnswers` — the student's submitted answers (JSON from QuizAttempt.answers).
 */
const buildBreakdown = (questions, rawAnswers) => {
  // Index student answers by questionId for O(1) lookup.
  const answerMap = new Map();
  for (const a of rawAnswers) {
    answerMap.set(a.questionId, a.selectedAnswer);
  }

  return questions.map((q) => {
    const selected = answerMap.get(q.id) ?? null;
    return {
      questionId: q.id,
      questionText: q.text,
      selectedAnswer: selected,
      correctAnswer: q.answer,
      isCorrect: selected !== null && selected === q.answer,
    };
  });
};

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/quizzes/:quizId/attempts
 *
 * Grades the student's answers server-side, enforces one-attempt-only,
 * and returns a full per-question breakdown.
 */
const submitAttempt = async (quizId, userId, answers) => {
  // 1. Fetch quiz + questions
  const quiz = await fetchQuizWithQuestions(quizId);

  if (quiz.status !== "ACTIVE") {
    throw new ApiError(403, "This quiz has been archived and is no longer accepting attempts.");
  }

  if (quiz.questions.length === 0) {
    throw new ApiError(400, "This quiz has no questions yet. Cannot submit an attempt.");
  }

  // 2. Verify enrollment in the quiz's course
  await assertEnrolled(userId, quiz.courseId);

  // 3. Grade — only count questions that exist in the quiz.
  //    Extra/unknown questionIds in the submission are silently ignored.
  const questionMap = new Map();
  for (const q of quiz.questions) {
    questionMap.set(q.id, q);
  }

  let correct = 0;
  for (const a of answers) {
    const q = questionMap.get(a.questionId);
    if (q && a.selectedAnswer === q.answer) {
      correct++;
    }
  }

  const totalQuestions = quiz.questions.length;
  const score = Math.round((correct / totalQuestions) * 100);
  const passed = score >= quiz.passMark;

  // 4. Persist (atomic uniqueness check)
  let attempt;
  try {
    attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score,
        passed,
        answers, // raw student answers stored as JSON
      },
      select: {
        id: true,
        score: true,
        passed: true,
        createdAt: true,
      },
    });
  } catch (error) {
    // P2002 = Unique constraint failed
    if (error.code === "P2002") {
      throw new ApiError(409, "You have already attempted this quiz.");
    }
    throw error;
  }

  // 5. Build detailed breakdown for the response
  const breakdown = buildBreakdown(quiz.questions, answers);

  return {
    attemptId: attempt.id,
    quizId: quiz.id,
    quizTitle: quiz.title,
    score: attempt.score,
    passed: attempt.passed,
    totalQuestions,
    correctCount: correct,
    submittedAt: attempt.createdAt,
    questions: breakdown,
  };
};

/**
 * GET /api/v1/quizzes/:quizId/attempts/me
 *
 * Returns the authenticated student's single attempt with the same
 * full breakdown shape returned by submitAttempt.
 */
const getMyAttempt = async (quizId, userId) => {
  // Fetch the quiz (also validates it exists) and the attempt in parallel.
  const [quiz, attempt] = await Promise.all([
    fetchQuizWithQuestions(quizId),
    prisma.quizAttempt.findFirst({
      where: { userId, quizId },
      select: {
        id: true,
        score: true,
        passed: true,
        answers: true,
        createdAt: true,
      },
    }),
  ]);

  if (!attempt) {
    throw new ApiError(404, "No attempt found for this quiz.");
  }

  const breakdown = buildBreakdown(quiz.questions, attempt.answers);

  return {
    attemptId: attempt.id,
    quizId: quiz.id,
    quizTitle: quiz.title,
    score: attempt.score,
    passed: attempt.passed,
    totalQuestions: quiz.questions.length,
    correctCount: breakdown.filter((q) => q.isCorrect).length,
    submittedAt: attempt.createdAt,
    questions: breakdown,
  };
};

/**
 * GET /api/v1/quizzes/:quizId/attempts  (INSTRUCTOR / ADMIN)
 *
 * Summary list of all attempts for the quiz — no per-question breakdown,
 * just student info + score + passed + date.
 */
const getAttemptsForQuiz = async (quizId, userId, role) => {
  // Validate quiz exists and caller owns the course.
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, title: true, courseId: true, passMark: true },
  });

  if (!quiz) throw new ApiError(404, "Quiz not found.");

  await assertCourseOwnership(quiz.courseId, userId, role);

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId },
    select: {
      id: true,
      score: true,
      passed: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    passMark: quiz.passMark,
    totalAttempts: attempts.length,
    attempts: attempts.map((a) => ({
      attemptId: a.id,
      student: a.user,
      score: a.score,
      passed: a.passed,
      submittedAt: a.createdAt,
    })),
  };
};

module.exports = { submitAttempt, getMyAttempt, getAttemptsForQuiz };
