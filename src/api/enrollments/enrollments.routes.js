const express = require("express");
const router = express.Router();

const EnrollmentController = require("./enrollments.controller");
const { validateEnrollBody, validateEnrollmentQuery } = require("./enrollments.validation");
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");

// POST /api/v1/enrollments — student enrolls in a course
router.post(
  "/",
  protect,
  requireRole(ROLES.STUDENT),
  validateEnrollBody,
  EnrollmentController.enrollInCourse
);

// POST /api/v1/enrollments/instructor-enroll — instructor enrolls a student
router.post(
  "/instructor-enroll",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  EnrollmentController.instructorEnroll
);

// GET /api/v1/enrollments/course/:courseId — instructor views their course's enrollments
router.get(
  "/course/:courseId",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  EnrollmentController.getCourseEnrollments
);

// GET /api/v1/enrollments/my — student's own enrollments
router.get(
  "/my",
  protect,
  requireRole(ROLES.STUDENT),
  validateEnrollmentQuery,
  EnrollmentController.getMyEnrollments
);

// GET /api/v1/enrollments — admin: list all enrollments
router.get(
  "/",
  protect,
  requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validateEnrollmentQuery,
  EnrollmentController.getAllEnrollments
);

// GET /api/v1/enrollments/:id — single enrollment (owner or admin, checked in service)
router.get("/:id", protect, EnrollmentController.getEnrollmentById);

// DELETE /api/v1/enrollments/:id — cancel enrollment (owner or admin, checked in service)
router.delete("/:id", protect, EnrollmentController.cancelEnrollment);

module.exports = router;
