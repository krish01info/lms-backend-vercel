const express = require("express")
const router = express.Router({ mergeParams: true })
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const ApiError = require("../../utils/ApiError")
const { protect, requireRole, checkEnrollment } = require("../../middleware/auth.middleware")
const { handleUpload, uploadLessonVideo } = require("../../middleware/upload.middleware")
const ROLES = require("../../constants/roles")
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/v1/courses/:courseId/lessons
router.get('/',
  protect,
  checkEnrollment,
  asyncHandler(async (req, res) => {
    const { courseId } = req.params
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        duration: true,
        order: true,
        isPreview: true,
        videoUrl: true,
        content: true,
      }
    })
    return res.status(200).json(
      new ApiResponse(200, { lessons }, 'Lessons fetched successfully.')
    )
  })
)

// GET /api/v1/courses/:courseId/lessons/:lessonId
router.get('/:lessonId',
  protect,
  checkEnrollment,
  asyncHandler(async (req, res) => {
    const { courseId, lessonId } = req.params
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, courseId }
    })
    if (!lesson) throw new ApiError(404, 'Lesson not found.')
    return res.status(200).json(
      new ApiResponse(200, { lesson }, 'Lesson fetched successfully.')
    )
  })
)

// POST /api/v1/courses/:courseId/lessons
router.post('/',
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { courseId } = req.params
    const { title, description, type, videoUrl, content, order, isPreview } = req.body
    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        type: type || 'VIDEO',
        videoUrl,
        content,
        order: order || 0,
        isPreview: isPreview || false,
        courseId
      }
    })
    return res.status(201).json(
      new ApiResponse(201, { lesson }, 'Lesson created successfully.')
    )
  })
)

// PATCH /api/v1/courses/:courseId/lessons/:lessonId
router.patch('/:lessonId',
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { lessonId } = req.params
    const { title, description, videoUrl, content, order, isPreview } = req.body
    const lesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: { title, description, videoUrl, content, order, isPreview }
    })
    return res.status(200).json(
      new ApiResponse(200, { lesson }, 'Lesson updated successfully.')
    )
  })
)

// DELETE /api/v1/courses/:courseId/lessons/:lessonId
router.delete('/:lessonId',
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { lessonId } = req.params
    await prisma.lesson.delete({ where: { id: lessonId } })
    return res.status(200).json(
      new ApiResponse(200, null, 'Lesson deleted successfully.')
    )
  })
)

// POST /api/v1/courses/:courseId/lessons/:lessonId/video
router.post("/:lessonId/video",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  handleUpload(uploadLessonVideo),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(
        new ApiResponse(400, null, "No file received.")
      )
    }
    const { courseId, lessonId } = req.params
    return res.status(202).json(
      new ApiResponse(202, {
        courseId,
        lessonId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        status: "PROCESSING",
      }, "Video uploaded and queued for transcoding.")
    )
  })
)

module.exports = router