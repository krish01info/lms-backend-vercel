const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const { protect } = require("../../middleware/auth.middleware")
const { prisma } = require("../../config/database")

// GET /api/v1/activity/my
// Synthesized activity feed — no dedicated ActivityLog table exists yet,
// so this merges recent rows from LessonProgress, QuizAttempt, and
// AssignmentSubmission into one timeline, sorted by recency.
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    const [completedLessons, quizAttempts, submissions] = await Promise.all([
      prisma.lessonProgress.findMany({
        where: { userId, completed: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          updatedAt: true,
          lesson: { select: { title: true, courseId: true } },
        },
      }),
      prisma.quizAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          score: true,
          passed: true,
          createdAt: true,
          quiz: { select: { title: true, courseId: true } },
        },
      }),
      prisma.assignmentSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          assignment: { select: { title: true, courseId: true } },
        },
      }),
    ])

    const activity = [
      ...completedLessons.map((lp) => ({
        id: `lesson-${lp.id}`,
        type: 'lesson',
        action: `Completed "${lp.lesson.title}"`,
        courseId: lp.lesson.courseId,
        timestamp: lp.updatedAt,
      })),
      ...quizAttempts.map((qa) => ({
        id: `quiz-${qa.id}`,
        type: 'quiz',
        action: `${qa.passed ? 'Passed' : 'Attempted'} "${qa.quiz.title}" (${qa.score}%)`,
        courseId: qa.quiz.courseId,
        timestamp: qa.createdAt,
      })),
      ...submissions.map((sub) => ({
        id: `assignment-${sub.id}`,
        type: 'assignment',
        action: `Submitted "${sub.assignment.title}"`,
        courseId: sub.assignment.courseId,
        timestamp: sub.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)

    res.status(200).json(new ApiResponse(200, { activity }, "Activity fetched"))
  })
)

module.exports = router