const express = require("express");
const router = express.Router();
const { handleUpload, uploadSubmission } = require("../../middleware/upload.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/assignments/:assignmentId/submit
// Student submits their assignment (single file)
// Field : submission  (PDF | DOCX | DOC | PNG | JPEG | ZIP — max 20 MB)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:assignmentId/submit",
  protect,
  handleUpload(uploadSubmission),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(
        new ApiResponse(400, null, "No file received. Attach your submission with field name 'submission'.")
      );
    }

    const { assignmentId } = req.params;

    // TODO:
    // 1. Upload file to S3/Supabase: submissions/{assignmentId}/{userId}/{filename}
    // 2. Create Submission record in DB:
    //    await SubmissionService.create({ assignmentId, userId: req.user.id, fileUrl });

    return res.status(201).json(
      new ApiResponse(201, {
        assignmentId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        submittedAt: new Date().toISOString(),
      }, "Assignment submitted successfully")
    );
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/assignments/submissions/:submissionId/grade
// Instructor grades a student submission (no file needed, just score)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/submissions/:submissionId/grade",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;

    if (grade === undefined || grade === null) {
      return res.status(400).json(new ApiResponse(400, null, "Grade is required."));
    }

    // TODO: await SubmissionService.grade(submissionId, { grade, feedback, gradedBy: req.user.id });

    return res.status(200).json(
      new ApiResponse(200, { submissionId, grade, feedback }, "Submission graded successfully")
    );
  })
);

module.exports = router;
