const express = require("express");
const router = express.Router();
const { handleUpload, uploadSubmission } = require("../../middleware/upload.middleware");
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");
const {
  getAssignments,
  getAssignmentById,
  createAssignment,
  submitAssignment,
  gradeSubmission,
  getSubmissions,
  getMySubmissions,
} = require("./assignments.controller");

// GET  /api/v1/assignments                            — list (filter by courseId)
router.get("/", protect, getAssignments);

// GET  /api/v1/assignments/my-submissions             — student's own submissions
router.get("/my-submissions", protect, requireRole(ROLES.STUDENT), getMySubmissions);

// GET  /api/v1/assignments/:id                        — single assignment
router.get("/:id", protect, getAssignmentById);

// POST /api/v1/assignments                            — instructor creates
router.post("/", protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), createAssignment);

// POST /api/v1/assignments/:assignmentId/submit       — student submits file
router.post("/:assignmentId/submit", protect, requireRole(ROLES.STUDENT), handleUpload(uploadSubmission), submitAssignment);

// PATCH /api/v1/assignments/submissions/:submissionId/grade  — instructor grades
router.patch("/submissions/:submissionId/grade", protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), gradeSubmission);

// GET  /api/v1/assignments/:assignmentId/submissions  — instructor views all submissions
router.get("/:assignmentId/submissions", protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), getSubmissions);

module.exports = router;