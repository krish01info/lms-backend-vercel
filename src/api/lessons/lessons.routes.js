
const express = require("express");
const router = express.Router({ mergeParams: true });

const { protect, requireRole, checkEnrollment } = require("../../middleware/auth.middleware");
const { handleUpload, uploadLessonVideo } = require("../../middleware/upload.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");

const {
  createLessonSchema,
  updateLessonSchema,
  lessonIdParamSchema,
  courseIdParamSchema,
} = require("./lessons.validation");

const {
  getLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
} = require("./lessons.controller");

const express = require("express")
const router = express.Router({ mergeParams: true })
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const ApiError = require("../../utils/ApiError")
const { protect, requireRole, checkEnrollment } = require("../../middleware/auth.middleware")
const { handleUpload, uploadLessonVideo } = require("../../middleware/upload.middleware")
const ROLES = require("../../constants/roles")
const { prisma } = require('../../config/database')

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

const { uploadToCloudinary } = require("../../utils/cloudinary");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

// GET /api/v1/courses/:courseId/lessons — enrolled students or instructor/admin
router.get("/", protect, checkEnrollment, getLessons);

// GET /api/v1/courses/:courseId/lessons/:lessonId — enrolled students or instructor/admin
router.get("/:lessonId", protect, checkEnrollment, getLessonById);

// POST /api/v1/courses/:courseId/lessons — instructor (owner)/admin
router.post(
  "/",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(courseIdParamSchema, "params"),
  validate(createLessonSchema),
  createLesson
);

// POST /api/v1/courses/:courseId/lessons/reorder — batch update lesson order
router.post(
  "/reorder",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(courseIdParamSchema, "params"),
  reorderLessons
);

// PATCH /api/v1/courses/:courseId/lessons/:lessonId — instructor (owner)/admin
router.patch(
  "/:lessonId",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(lessonIdParamSchema, "params"),
  validate(updateLessonSchema),
  updateLesson
);

// DELETE /api/v1/courses/:courseId/lessons/:lessonId — instructor (owner)/admin
router.delete(
  "/:lessonId",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(lessonIdParamSchema, "params"),
  deleteLesson
);

// POST /api/v1/courses/:courseId/lessons/:lessonId/video — upload lesson video
router.post(
  "/:lessonId/video",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(lessonIdParamSchema, "params"),
  handleUpload(uploadLessonVideo),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(new ApiResponse(400, null, "No file received."));
    }

    const { courseId, lessonId } = req.params;

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, "lessons", "video");

    // Update the lesson with the video URL
    const { updateLesson } = require("./lessons.service");
    await updateLesson(courseId, lessonId, { videoUrl: uploadResult.secure_url }, req.user.id, req.user.role);

    return res.status(200).json(
      new ApiResponse(200, {
        lessonId,
        videoUrl: uploadResult.secure_url,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      }, "Video uploaded successfully.")
    );
  })
);

module.exports = router;