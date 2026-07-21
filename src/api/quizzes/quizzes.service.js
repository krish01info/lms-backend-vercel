const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

// Fields we return to the client for every quiz.
// Mirrors the `courseSelect` pattern in courses.service.js.
const quizSelect = {
  id: true,
  title: true,
  courseId: true,
  timeLimit: true,
  passMark: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { id: true, title: true } },
  _count: { select: { questions: true, attempts: true } },
};

// Reshapes Prisma's _count object into flat, friendly fields.
const formatQuiz = (quiz) => ({
  ...quiz,
  questionCount: quiz._count.questions,
  attemptCount: quiz._count.attempts,
  _count: undefined,
});

// Shared ownership guard used by create / update / delete.
// Throws 404 if the course doesn't exist, 403 if this user isn't
// allowed to manage quizzes on it.
const assertCourseOwnership = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });

  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to manage quizzes for this course.");
  }

  return course;
};

// POST /api/v1/quizzes
const createQuiz = async ({ title, courseId, timeLimit, passMark, userId, role }) => {
  await assertCourseOwnership(courseId, userId, role);

  const quiz = await prisma.quiz.create({
    data: {
      title,
      courseId,
      timeLimit: timeLimit !== undefined && timeLimit !== null ? Number(timeLimit) : null,
      ...(passMark !== undefined && { passMark: Number(passMark) }), // else Prisma applies schema default (70)
    },
    select: quizSelect,
  });

  return formatQuiz(quiz);
};

// GET /api/v1/quizzes/my — quizzes from ALL courses the logged-in student is enrolled in.
// This is the primary endpoint the student QuizzesPage calls.
const getMyQuizzes = async (userId) => {
  const enrolledCourseIds = await prisma.enrollment.findMany({
    where: { userId, status: "ACTIVE" },
    select: { courseId: true },
  });

  const courseIds = enrolledCourseIds.map((e) => e.courseId);
  if (courseIds.length === 0) return { quizzes: [] };

  const quizzes = await prisma.quiz.findMany({
    where: { courseId: { in: courseIds }, status: "ACTIVE" },
    select: quizSelect,
    orderBy: { createdAt: "desc" },
  });

  return { quizzes: quizzes.map(formatQuiz) };
};

// GET /api/v1/quizzes?courseId=&page=&limit=
// STUDENT (or unauthenticated) callers only ever see ACTIVE quizzes.
// INSTRUCTOR/ADMIN/SUPER_ADMIN see all statuses so archived quizzes they
// own remain visible (with an "ARCHIVED" badge) instead of disappearing.
const getQuizzes = async ({ courseId, page = 1, limit = 12, role } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const isPrivileged = [ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  const where = {
    ...(!isPrivileged && { status: "ACTIVE" }),
    ...(courseId && { courseId }),
  };

  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      select: quizSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.quiz.count({ where }),
  ]);

  return {
    quizzes: quizzes.map(formatQuiz),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// GET /api/v1/quizzes/:id
const getQuizById = async (id) => {
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: quizSelect });
  if (!quiz) throw new ApiError(404, "Quiz not found.");
  return formatQuiz(quiz);
};

// PATCH /api/v1/quizzes/:id
const updateQuiz = async (id, { title, timeLimit, passMark }, userId, role) => {
  const existing = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true, courseId: true },
  });
  if (!existing) throw new ApiError(404, "Quiz not found.");

  await assertCourseOwnership(existing.courseId, userId, role);

  const updated = await prisma.quiz.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(timeLimit !== undefined && { timeLimit: timeLimit === null ? null : Number(timeLimit) }),
      ...(passMark !== undefined && { passMark: Number(passMark) }),
    },
    select: quizSelect,
  });

  return formatQuiz(updated);
};

// DELETE /api/v1/quizzes/:id
const deleteQuiz = async (id, userId, role) => {
  const existing = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true, courseId: true },
  });
  if (!existing) throw new ApiError(404, "Quiz not found.");

  await assertCourseOwnership(existing.courseId, userId, role);

  await prisma.quiz.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  return { id };
};

module.exports = { createQuiz, getQuizzes, getMyQuizzes, getQuizById, updateQuiz, deleteQuiz, assertCourseOwnership };
