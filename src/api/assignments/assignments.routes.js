const express = require("express");
const router = express.Router();
const { handleUpload, uploadSubmission } = require("../../middleware/upload.middleware");
const { protect, requireRole } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");
const {
  createAssignmentSchema,
  updateAssignmentSchema,
  gradeSubmissionSchema,
} = require("./assignments.validation");
const {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  getSubmissions,
  getSubmissionById,
  gradeSubmission,
} = require("./assignments.controller");

// ─── Assignment CRUD ──────────────────────────────────────────────────────────

// POST /api/v1/assignments — instructor/admin, courseId in body
router.post(
  "/",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(createAssignmentSchema),
  createAssignment
);

// GET /api/v1/assignments?courseId=&page=&limit= — instructor sees their own
// courses' assignments (or all, if courseId given & they own it); student sees
// assignments for courses they're enrolled in.
router.get("/", protect, getAssignments);

// GET /api/v1/assignments/:id
router.get("/:id", protect, getAssignmentById);

// PATCH /api/v1/assignments/:id — instructor (owner)/admin
router.patch(
  "/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(updateAssignmentSchema),
  updateAssignment
);

// DELETE /api/v1/assignments/:id — instructor (owner)/admin
router.delete("/:id", protect, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), deleteAssignment);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/assignments/:assignmentId/submit
// Student submits (or resubmits, before the due date) their assignment.
// Field : submission  (PDF | DOCX | DOC | PNG | JPEG | ZIP — max 20 MB)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:assignmentId/submit",
  protect,
  handleUpload(uploadSubmission),
  submitAssignment
);

// GET /api/v1/assignments/:assignmentId/submissions — instructor (owner)/admin
// Lists every student's submission for one assignment, ungraded first.
router.get(
  "/:assignmentId/submissions",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  getSubmissions
);

// GET /api/v1/assignments/submissions/:submissionId — instructor/admin, or the
// student who owns the submission.
router.get("/submissions/:submissionId", protect, getSubmissionById);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/assignments/submissions/:submissionId/grade
// Instructor grades a student submission — grade (0-100) + optional feedback.
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/submissions/:submissionId/grade",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(gradeSubmissionSchema),
  gradeSubmission
);

module.exports = router;
