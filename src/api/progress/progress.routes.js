const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const ApiError = require("../../utils/ApiError")
const { protect, requireRole } = require("../../middleware/auth.middleware")
const ROLES = require("../../constants/roles")
const { prisma } = require('../../config/database')

// GET /api/v1/progress/my
// Returns per-course progress summary for the logged-in student:
// total lessons, completed lessons, percentage complete.
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

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

    const now = new Date()
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6))

    const records = await prisma.lessonProgress.findMany({
      where: { userId, updatedAt: { gte: since } },
      select: { watchedTime: true, updatedAt: true },
    })

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const buckets = new Map()
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate() + i))
      buckets.set(d.toISOString().slice(0, 10), 0)
    }

    for (const r of records) {
      const key = r.updatedAt.toISOString().slice(0, 10)
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + r.watchedTime)
    }

    const weeklyHours = [...buckets.entries()].map(([key, seconds]) => ({
      name: dayLabels[new Date(key).getUTCDay()],
      hours: Number((seconds / 3600).toFixed(1)),
    }))

    return res.status(200).json(
      new ApiResponse(200, { weeklyHours }, 'Weekly study hours fetched successfully.')
    )
  })
)

// GET /api/v1/progress/course/:courseId/students
// Instructor/admin view: per-student lesson completion % for a course.
// Used by the Student Performance page to gate certificate issuance —
// a certificate should only be issuable once a student has completed
// 100% of the course's lessons.
router.get('/course/:courseId/students',
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { courseId } = req.params

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, lessons: { select: { id: true } } },
    })
    if (!course) throw new ApiError(404, 'Course not found.')

    const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role)
    if (!isPrivileged && course.instructorId !== req.user.id) {
      throw new ApiError(403, 'You do not have permission to view this course.')
    }

    const totalLessons = course.lessons.length
    const lessonIds = course.lessons.map(l => l.id)

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    })

    const progressRecords = totalLessons > 0
      ? await prisma.lessonProgress.findMany({
          where: { lessonId: { in: lessonIds }, completed: true },
          select: { userId: true, lessonId: true },
        })
      : []

    const completedByUser = new Map()
    for (const p of progressRecords) {
      if (!completedByUser.has(p.userId)) completedByUser.set(p.userId, new Set())
      completedByUser.get(p.userId).add(p.lessonId)
    }

    const students = enrollments.map((enr) => {
      const completedCount = completedByUser.get(enr.user.id)?.size ?? 0
      const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0
      return {
        userId: enr.user.id,
        name: enr.user.name,
        completedLessons: completedCount,
        totalLessons,
        percentage,
      }
    })

    return res.status(200).json(
      new ApiResponse(200, { students }, 'Course completion fetched successfully.')
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
// When a lesson is completed, an AttendanceRecord is auto-created as PRESENT for the
// lesson's date, so teachers can see auto-attendance in their roster.
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

    if (completed === true || (completed === undefined && progress.completed)) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { courseId: true, createdAt: true, course: { select: { instructorId: true } } },
      })

      if (lesson) {
        const d = new Date(lesson.createdAt)
        const lessonDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

        await prisma.attendanceRecord.upsert({
          where: {
            courseId_userId_date: {
              courseId: lesson.courseId,
              userId,
              date: lessonDate,
            },
          },
          update: { status: 'PRESENT', markedById: lesson.course.instructorId },
          create: {
            courseId: lesson.courseId,
            userId,
            date: lessonDate,
            status: 'PRESENT',
            markedById: lesson.course.instructorId,
          },
        })
      }
    }

    return res.status(200).json(
      new ApiResponse(200, { progress }, 'Progress updated successfully.')
    )
  })
)

module.exports = router