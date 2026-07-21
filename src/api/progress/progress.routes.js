const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const ApiError = require("../../utils/ApiError")
const { protect } = require("../../middleware/auth.middleware")
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/v1/progress/my
// Returns per-course progress summary for the logged-in student:
// total lessons, completed lessons, percentage complete.
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    // Get all active enrollments for this user, with course + lesson counts
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            lessons: { select: { id: true } },
          }
        }
      }
    })

    // Get all lesson progress records for this user in one query
    const lessonProgressRecords = await prisma.lessonProgress.findMany({
      where: { userId, completed: true },
      select: { lessonId: true }
    })
    const completedLessonIds = new Set(lessonProgressRecords.map(p => p.lessonId))

    const progress = enrollments.map((enr) => {
      const totalLessons = enr.course.lessons.length
      const completedCount = enr.course.lessons.filter(l => completedLessonIds.has(l.id)).length
      const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

      return {
        courseId: enr.course.id,
        courseTitle: enr.course.title,
        thumbnail: enr.course.thumbnail,
        totalLessons,
        completedLessons: completedCount,
        percentage,
      }
    })

    return res.status(200).json(
      new ApiResponse(200, { progress }, 'Progress fetched successfully.')
    )
  })
)

// GET /api/v1/progress/my/weekly-hours
// Real study time for the last 7 days, derived from LessonProgress.watchedTime
// (grouped by the day it was last updated). Powers the "Weekly Study Hours" chart.
router.get('/my/weekly-hours',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id
    const since = new Date()
    since.setDate(since.getDate() - 6)
    since.setHours(0, 0, 0, 0)

    const records = await prisma.lessonProgress.findMany({
      where: { userId, updatedAt: { gte: since } },
      select: { watchedTime: true, updatedAt: true },
    })

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const buckets = new Map() // 'YYYY-MM-DD' -> seconds
    for (let i = 0; i < 7; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      buckets.set(d.toISOString().slice(0, 10), 0)
    }

    for (const r of records) {
      const key = r.updatedAt.toISOString().slice(0, 10)
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + r.watchedTime)
    }

    const weeklyHours = [...buckets.entries()].map(([key, seconds]) => ({
      name: dayLabels[new Date(key).getDay()],
      hours: Number((seconds / 3600).toFixed(1)),
    }))

    return res.status(200).json(
      new ApiResponse(200, { weeklyHours }, 'Weekly study hours fetched successfully.')
    )
  })
)

// GET /api/v1/progress/:courseId
// Detailed lesson-by-lesson progress for a single course.
router.get('/:courseId',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { courseId } = req.params

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId, status: 'ACTIVE' }
    })
    if (!enrollment) throw new ApiError(403, 'You are not actively enrolled in this course.')

    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, order: true, duration: true }
    })

    const progressRecords = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessons.map(l => l.id) } }
    })
    const progressMap = new Map(progressRecords.map(p => [p.lessonId, p]))

    const lessonsWithProgress = lessons.map((lesson) => ({
      ...lesson,
      completed: progressMap.get(lesson.id)?.completed || false,
      watchedTime: progressMap.get(lesson.id)?.watchedTime || 0,
    }))

    return res.status(200).json(
      new ApiResponse(200, { courseId, lessons: lessonsWithProgress }, 'Course progress fetched successfully.')
    )
  })
)

// PATCH /api/v1/progress/:lessonId
// Marks a lesson as complete / updates watched time (called when student finishes a video).
router.patch('/:lessonId',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { lessonId } = req.params
    const { completed, watchedTime } = req.body

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        ...(completed !== undefined && { completed }),
        ...(watchedTime !== undefined && { watchedTime }),
      },
      create: {
        userId,
        lessonId,
        completed: completed || false,
        watchedTime: watchedTime || 0,
      }
    })

    return res.status(200).json(
      new ApiResponse(200, { progress }, 'Progress updated successfully.')
    )
  })
)

module.exports = router