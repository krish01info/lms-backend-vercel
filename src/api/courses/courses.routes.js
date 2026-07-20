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
const { getCourses, getCourseById, getMyCourses, getEnrolledCourses, createCourse, updateCourse, updateCourseStatus, deleteCourse } = require("./courses.controller");

// ─── GET /api/v1/courses  — public browse with optional auth ──────────────────
router.get("/",        optionalAuth, getCourses);
router.get("/enrolled", protect, getEnrolledCourses);   // student enrolled courses
router.get("/my",       protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), getMyCourses);
router.get("/:id",     optionalAuth, getCourseById);
router.post("/",       protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), createCourse);

// ─── Manage course ────────────────────────────────────────────────────────────
// PATCH /api/v1/courses/:id          — update title, description, price, etc.
router.patch("/:id",        protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), updateCourse);
// PATCH /api/v1/courses/:id/status   — change to DRAFT | PUBLISHED | ARCHIVED
router.patch("/:id/status", protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), updateCourseStatus);
// DELETE /api/v1/courses/:id         — delete a course
router.delete("/:id",       protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), deleteCourse);


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/courses/:courseId/thumbnail
// Upload / replace a course cover image (instructors & admins only)
// Field : thumbnail  (JPEG | PNG | WEBP — max 5 MB)
// ─────────────────────────────────────────────────────────────────────────────
const { uploadToCloudinary } = require("../../utils/cloudinary");
const CourseService = require("./courses.service");

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

    // Stream thumbnail buffer to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, "courses", "image");
    
    // Update thumbnail URL in Supabase database
    const updatedCourse = await CourseService.updateThumbnail(courseId, uploadResult.secure_url, req.user.id);

    return res.status(200).json(
      new ApiResponse(200, {
        course: updatedCourse,
        originalName: req.file.originalname,
        secureUrl: uploadResult.secure_url,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      }, "Course thumbnail uploaded successfully")
    );
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Course resources — downloadable files (PDFs, docs, zips, images)
//   GET    /api/v1/courses/:courseId/resources        — list (instructor, or enrolled student)
//   POST   /api/v1/courses/:courseId/resources         — upload up to 10 files (instructor/admin)
//   DELETE /api/v1/courses/:courseId/resources/:id     — remove one (instructor/admin)
// ─────────────────────────────────────────────────────────────────────────────
const { getResources, postResources, removeResource } = require("../resources/resources.controller");

router.get("/:courseId/resources", protect, getResources);

router.post(
  "/:courseId/resources",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  handleUpload(uploadCourseResources),
  postResources
);

router.delete(
  "/:courseId/resources/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  removeResource
);

module.exports = router;
