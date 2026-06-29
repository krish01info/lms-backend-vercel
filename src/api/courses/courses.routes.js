const express = require("express");
const router = express.Router();
const {
  handleUpload,
  uploadCourseThumbnail,
  uploadCourseResources,
} = require("../../middleware/upload.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { protect, requireRole, optionalAuth } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");
const { getCourses, getCourseById, getMyCourses, getEnrolledCourses, createCourse } = require("./courses.controller");

// ─── GET /api/v1/courses  — public browse with optional auth ──────────────────
router.get("/",        optionalAuth, getCourses);
router.get("/enrolled", protect, getEnrolledCourses);   // student enrolled courses
router.get("/my",       protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), getMyCourses);
router.get("/:id",     optionalAuth, getCourseById);
router.post("/",       protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), createCourse);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/courses/:courseId/thumbnail
// Upload / replace a course cover image (instructors & admins only)
// Field : thumbnail  (JPEG | PNG | WEBP — max 5 MB)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:courseId/thumbnail",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  handleUpload(uploadCourseThumbnail),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(
        new ApiResponse(400, null, "No file received. Attach an image with field name 'thumbnail'.")
      );
    }

    const { courseId } = req.params;

    // TODO: upload req.file.buffer to S3/Supabase under courses/{courseId}/thumbnail
    // const thumbnailUrl = await uploadToStorage(req.file, `courses/${courseId}`);
    // await CourseService.updateThumbnail(courseId, thumbnailUrl, req.user.id);

    return res.status(200).json(
      new ApiResponse(200, {
        courseId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      }, "Course thumbnail uploaded successfully")
    );
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/courses/:courseId/resources
// Upload up to 10 resource files (PDFs, images, ZIPs) for a course
// Field : resources[]  (max 10 MB each, up to 10 files)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:courseId/resources",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  handleUpload(uploadCourseResources),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json(
        new ApiResponse(400, null, "No files received. Attach files with field name 'resources'.")
      );
    }

    const { courseId } = req.params;

    // TODO: upload each file in req.files to S3/Supabase and store URLs in DB
    // const uploaded = await Promise.all(req.files.map(f => uploadToStorage(f, `courses/${courseId}/resources`)));

    const summary = req.files.map((f) => ({
      originalName: f.originalname,
      mimeType: f.mimetype,
      sizeBytes: f.size,
    }));

    return res.status(200).json(
      new ApiResponse(200, { courseId, files: summary }, `${req.files.length} resource(s) uploaded successfully`)
    );
  })
);

module.exports = router;
