const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const { protect } = require("../../middleware/auth.middleware")
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Helper: format a Date as YYYY-MM-DD (day-level granularity)
function toDateOnly(date) {
  return new Date(date).toISOString().split('T')[0]
}

// GET /api/v1/attendance/my
// Derives attendance from lesson-watching activity (LessonProgress),
// since there is no live-class/schedule model in this app.
// Denominator = distinct days on which lesson material was published (Lesson.createdAt).
// Numerator   = distinct days the student completed a lesson (LessonProgress.updatedAt).
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    // Active enrollments with course + lessons (need lesson.createdAt to know "material days")
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            lessons: { select: { id: true, createdAt: true } }
          }
        }
      }
    })

    // All completed lesson progress records for this user
    const progressRecords = await prisma.lessonProgress.findMany({
      where: { userId, completed: true },
      select: { lessonId: true, updatedAt: true }
    })

    // Map lessonId -> courseId/title for quick lookup
    const lessonToCourse = new Map()
    enrollments.forEach((enr) => {
      enr.course.lessons.forEach((lesson) => {
        lessonToCourse.set(lesson.id, { courseId: enr.course.id, courseTitle: enr.course.title })
      })
    })

    // Build "present" records: one entry per (date, course) where student completed a lesson
    const seen = new Set()
    const records = []

    progressRecords.forEach((p) => {
      const course = lessonToCourse.get(p.lessonId)
      if (!course) return // lesson not in an active enrollment, skip

      const date = toDateOnly(p.updatedAt)
      const key = `${date}_${course.courseId}`
      if (seen.has(key)) return
      seen.add(key)

      records.push({
        date,
        subject: course.courseTitle,
        status: 'present',
      })
    })

    // Sort newest first
    records.sort((a, b) => (a.date < b.date ? 1 : -1))

    // Calculate attendance percentage per course:
    // denominator = distinct days material was published for that course
    const summary = enrollments.map((enr) => {
      const materialDays = new Set(
        enr.course.lessons.map((l) => toDateOnly(l.createdAt))
      ).size

      const activeDays = new Set(
        records.filter((r) => r.subject === enr.course.title).map((r) => r.date)
      ).size

      const percentage = materialDays > 0
        ? Math.min(100, Math.round((activeDays / materialDays) * 100))
        : 0

      return {
        courseId: enr.course.id,
        courseTitle: enr.course.title,
        activeDays,
        materialDays,
        percentage,
      }
    })

    const overallPercentage = summary.length
      ? Math.round(summary.reduce((acc, s) => acc + s.percentage, 0) / summary.length)
      : 0

    return res.status(200).json(
      new ApiResponse(200, { records, summary, overallPercentage }, 'Attendance fetched successfully.')
    )
  })
)

module.exports = router