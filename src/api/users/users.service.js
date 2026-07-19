const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      isVerified: true,
      createdAt: true,
      _count: {
        select: {
          enrollments: true,
          courses: true,
        },
      },
    },
  });

  if (!user) throw new ApiError(404, "User not found.");

  return {
    ...user,
    role: user.role.toLowerCase(),
    enrolledCount: user._count.enrollments,
    coursesCount: user._count.courses,
    _count: undefined,
  };
};

const updateProfile = async (userId, { name, avatar }) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { ...(name && { name }), ...(avatar && { avatar }) },
    select: { id: true, name: true, email: true, role: true, avatar: true, isVerified: true },
  });
  return { ...user, role: user.role.toLowerCase() };
};

// GET /api/v1/users/me/teaching-stats — aggregate teaching activity for the
// instructor profile page. Everything here is derived from existing data
// (courses, enrollments, quizzes, attempts) — no new schema fields needed.
const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED"];

const getTeachingStats = async (instructorId) => {
  const courses = await prisma.course.findMany({
    where: { instructorId },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      category: { select: { name: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: ACTIVE_ENROLLMENT_STATUSES } } },
          quizzes: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const courseIds = courses.map((c) => c.id);

  // Distinct students across all of the instructor's courses — a student
  // enrolled in 3 of your courses should count once, not three times.
  const distinctStudents = courseIds.length
    ? await prisma.enrollment.findMany({
        where: { courseId: { in: courseIds }, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
        select: { userId: true },
        distinct: ["userId"],
      })
    : [];

  const totalQuizzes = courses.reduce((sum, c) => sum + c._count.quizzes, 0);

  const attemptStats = courseIds.length
    ? await prisma.quizAttempt.aggregate({
        where: { quiz: { courseId: { in: courseIds } } },
        _count: { _all: true },
        _avg: { score: true },
      })
    : { _count: { _all: 0 }, _avg: { score: null } };

  const passedAttempts = courseIds.length
    ? await prisma.quizAttempt.count({
        where: { quiz: { courseId: { in: courseIds } }, passed: true },
      })
    : 0;

  const totalAttempts = attemptStats._count._all;
  const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : null;

  const categories = [
    ...new Set(courses.map((c) => c.category?.name).filter(Boolean)),
  ];

  const publishedCount = courses.filter((c) => c.status === "PUBLISHED").length;
  const draftCount = courses.filter((c) => c.status === "DRAFT").length;

  return {
    totalStudents: distinctStudents.length,
    totalCourses: courses.length,
    publishedCount,
    draftCount,
    categories,
    quizStats: {
      totalQuizzes,
      totalAttempts,
      averageScore: attemptStats._avg.score !== null ? Math.round(attemptStats._avg.score) : null,
      passRate,
    },
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      studentCount: c._count.enrollments,
      createdAt: c.createdAt,
    })),
    lastCourseCreatedAt: courses[0]?.createdAt ?? null, // courses already sorted desc
  };
};

module.exports = { getProfile, updateProfile, getTeachingStats };
