const { prisma } = require("../../config/database");

/**
 * Aggregates a student's real grade data — quiz attempt scores and graded
 * assignment submissions — per enrolled course. There's no separate "grade"
 * storage; this is a pure read-model over QuizAttempt + AssignmentSubmission,
 * same pattern as gradebook.service.js uses for the instructor-facing view.
 */
const getMyResults = async (userId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { course: { select: { id: true, title: true } } },
  });

  const courseIds = enrollments.map((e) => e.courseId);
  if (courseIds.length === 0) {
    return { subjects: [], gpa: null, quizAverage: null, assignmentAverage: null };
  }

  const [quizAttempts, gradedSubmissions] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId, quiz: { courseId: { in: courseIds } } },
      include: { quiz: { select: { courseId: true, title: true, passMark: true } } },
    }),
    prisma.assignmentSubmission.findMany({
      where: { userId, grade: { not: null }, assignment: { courseId: { in: courseIds } } },
      include: { assignment: { select: { courseId: true, title: true } } },
    }),
  ]);

  const subjects = enrollments.map((enr) => {
    const courseQuizzes = quizAttempts.filter((a) => a.quiz.courseId === enr.courseId);
    const courseAssignments = gradedSubmissions.filter((s) => s.assignment.courseId === enr.courseId);

    const quizAvg = courseQuizzes.length
      ? Math.round(courseQuizzes.reduce((sum, a) => sum + a.score, 0) / courseQuizzes.length)
      : null;
    const assignmentAvg = courseAssignments.length
      ? Math.round(courseAssignments.reduce((sum, s) => sum + s.grade, 0) / courseAssignments.length)
      : null;

    const scores = [quizAvg, assignmentAvg].filter((v) => v !== null);
    const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return {
      courseId: enr.courseId,
      subject: enr.course.title,
      score,
      quizAverage: quizAvg,
      assignmentAverage: assignmentAvg,
      quizCount: courseQuizzes.length,
      assignmentCount: courseAssignments.length,
      fullMark: 100,
    };
  });

  const scored = subjects.filter((s) => s.score !== null);
  const overallScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
    : null;

  return {
    subjects,
    // GPA on a 4.0 scale, derived from the overall percentage — no separate GPA storage.
    gpa: overallScore !== null ? Number((overallScore / 25).toFixed(2)) : null,
    overallScore,
  };
};

module.exports = { getMyResults };
