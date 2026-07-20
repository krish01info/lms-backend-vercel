const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED"];

// Weighting for the overall grade — adjust these two constants if you want a
// different split (they must add up to 1).
const QUIZ_WEIGHT = 0.5;
const ASSIGNMENT_WEIGHT = 0.5;

const assertCourseOwnership = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, instructorId: true },
  });

  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to view the gradebook for this course.");
  }

  return course;
};

const average = (numbers) => (numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null);

// GET /api/v1/gradebook/:courseId — instructor owner/admin.
// Pure aggregation over existing QuizAttempt.score and
// AssignmentSubmission.grade — no separate grade-storage table.
const getGradebook = async (courseId, userId, role) => {
  const course = await assertCourseOwnership(courseId, userId, role);

  const [enrollments, quizzes, assignments] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
      select: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.quiz.findMany({
      where: { courseId },
      select: {
        id: true,
        title: true,
        attempts: { select: { userId: true, score: true, passed: true } },
      },
    }),
    prisma.assignment.findMany({
      where: { courseId },
      select: {
        id: true,
        title: true,
        submissions: { select: { userId: true, grade: true } },
      },
    }),
  ]);

  const rows = enrollments.map(({ user }) => {
    const quizResults = quizzes
      .map((quiz) => {
        const attempt = quiz.attempts.find((a) => a.userId === user.id);
        return attempt ? { quizId: quiz.id, title: quiz.title, score: attempt.score, passed: attempt.passed } : null;
      })
      .filter(Boolean);

    const assignmentResults = assignments
      .map((assignment) => {
        const submission = assignment.submissions.find((s) => s.userId === user.id);
        return submission
          ? { assignmentId: assignment.id, title: assignment.title, grade: submission.grade }
          : null;
      })
      .filter(Boolean);

    // Ungraded/unsubmitted items are EXCLUDED from the average, not counted
    // as zero — "not assessed yet" isn't the same as "scored zero".
    const quizAverage = average(quizResults.map((q) => q.score));
    const gradedAssignments = assignmentResults.filter((a) => a.grade !== null);
    const assignmentAverage = average(gradedAssignments.map((a) => a.grade));

    let overallGrade = null;
    if (quizAverage !== null && assignmentAverage !== null) {
      overallGrade = Math.round(quizAverage * QUIZ_WEIGHT + assignmentAverage * ASSIGNMENT_WEIGHT);
    } else if (quizAverage !== null) {
      overallGrade = Math.round(quizAverage);
    } else if (assignmentAverage !== null) {
      overallGrade = Math.round(assignmentAverage);
    }
    // else: no quiz attempts and no graded assignments yet -> null ("No grades yet")

    return {
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      quizzes: quizResults,
      assignments: assignmentResults,
      quizAverage: quizAverage !== null ? Math.round(quizAverage) : null,
      assignmentAverage: assignmentAverage !== null ? Math.round(assignmentAverage) : null,
      overallGrade,
    };
  });

  return {
    course: { id: course.id, title: course.title },
    quizzes: quizzes.map((q) => ({ id: q.id, title: q.title })),
    assignments: assignments.map((a) => ({ id: a.id, title: a.title })),
    rows,
  };
};

module.exports = { getGradebook };
