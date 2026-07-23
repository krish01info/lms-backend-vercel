const { prisma } = require("../../config/database");
 
const getMyResults = async (userId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { course: { select: { id: true, title: true } } },
  });
 
  const courseIds = enrollments.map((e) => e.courseId);
  if (courseIds.length === 0) {
    return { subjects: [], gpa: null, overallScore: null };
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
    gpa: overallScore !== null ? Number((overallScore / 25).toFixed(2)) : null,
    overallScore,
  };
};
 
const getMyRank = async (userId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
    select: { courseId: true },
  })
  const courseIds = enrollments.map(e => e.courseId)
  if (courseIds.length === 0) return { classRank: null, totalStudents: null, percentile: null }
 
  const allEnrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds }, status: { in: ['ACTIVE', 'COMPLETED'] } },
    select: { userId: true },
    distinct: ['userId'],
  })
  const allStudentIds = allEnrollments.map(e => e.userId)
  const totalStudents = allStudentIds.length
 
  const scores = await Promise.all(
    allStudentIds.map(async (sid) => {
      const attempts = await prisma.quizAttempt.findMany({
        where: { userId: sid, quiz: { courseId: { in: courseIds } } },
        select: { score: true },
      })
      const submissions = await prisma.assignmentSubmission.findMany({
        where: { userId: sid, grade: { not: null }, assignment: { courseId: { in: courseIds } } },
        select: { grade: true },
      })
      const allScores = [
        ...attempts.map(a => a.score),
        ...submissions.map(s => s.grade),
      ]
      const avg = allScores.length
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0
      return { userId: sid, avg }
    })
  )
 
  scores.sort((a, b) => b.avg - a.avg)
  const classRank = scores.findIndex(s => s.userId === userId) + 1
  const percentile = Math.round(((totalStudents - classRank) / totalStudents) * 100)
 
  return { classRank, totalStudents, percentile }
}
 
module.exports = { getMyResults, getMyRank };
