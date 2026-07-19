const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const AssignmentService = require("./assignments.service");
const { uploadToCloudinary } = require("../../utils/cloudinary");

// POST /api/v1/assignments
const createAssignment = asyncHandler(async (req, res) => {
  const { title, description, dueDate, courseId } = req.body;

  const assignment = await AssignmentService.createAssignment({
    title,
    description,
    dueDate,
    courseId,
    userId: req.user.id,
    role: req.user.role,
  });

  return res.status(201).json(new ApiResponse(201, { assignment }, "Assignment created successfully."));
});

// GET /api/v1/assignments?courseId=&page=&limit=
const getAssignments = asyncHandler(async (req, res) => {
  const { courseId, page, limit } = req.query;

  const result = await AssignmentService.getAssignments({
    courseId,
    page,
    limit,
    userId: req.user.id,
    role: req.user.role,
  });

  return res.status(200).json(new ApiResponse(200, result, "Assignments fetched successfully."));
});

// GET /api/v1/assignments/:id
const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await AssignmentService.getAssignmentById(req.params.id, req.user.id, req.user.role);

  return res.status(200).json(new ApiResponse(200, { assignment }, "Assignment fetched successfully."));
});

// PATCH /api/v1/assignments/:id
const updateAssignment = asyncHandler(async (req, res) => {
  const { title, description, dueDate } = req.body;

  const assignment = await AssignmentService.updateAssignment(
    req.params.id,
    { title, description, dueDate },
    req.user.id,
    req.user.role
  );

  return res.status(200).json(new ApiResponse(200, { assignment }, "Assignment updated successfully."));
});

// DELETE /api/v1/assignments/:id
const deleteAssignment = asyncHandler(async (req, res) => {
  await AssignmentService.deleteAssignment(req.params.id, req.user.id, req.user.role);

  return res.status(200).json(new ApiResponse(200, null, "Assignment deleted successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/assignments/:assignmentId/submit
// Student submits (or resubmits) their assignment — single file only.
// Field: submission (PDF | DOCX | DOC | PNG | JPEG | ZIP — max 20 MB)
// ─────────────────────────────────────────────────────────────────────────────
const submitAssignment = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No file received. Attach your submission with field name 'submission'.");
  }

  const { assignmentId } = req.params;

  const uploadResult = await uploadToCloudinary(req.file.buffer, "assignments/submissions", "auto");

  const submission = await AssignmentService.submitAssignment({
    assignmentId,
    userId: req.user.id,
    fileUrl: uploadResult.secure_url,
  });

  return res.status(201).json(new ApiResponse(201, { submission }, "Assignment submitted successfully."));
});

// GET /api/v1/assignments/:assignmentId/submissions — instructor/admin only.
const getSubmissions = asyncHandler(async (req, res) => {
  const submissions = await AssignmentService.getSubmissions(
    req.params.assignmentId,
    req.user.id,
    req.user.role
  );

  return res.status(200).json(new ApiResponse(200, { submissions }, "Submissions fetched successfully."));
});

// GET /api/v1/assignments/submissions/:submissionId
const getSubmissionById = asyncHandler(async (req, res) => {
  const submission = await AssignmentService.getSubmissionById(
    req.params.submissionId,
    req.user.id,
    req.user.role
  );

  return res.status(200).json(new ApiResponse(200, { submission }, "Submission fetched successfully."));
});

// PATCH /api/v1/assignments/submissions/:submissionId/grade
const gradeSubmission = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { grade, feedback } = req.body;

  const submission = await AssignmentService.gradeSubmission(
    submissionId,
    { grade, feedback },
    req.user.id,
    req.user.role
  );

  return res.status(200).json(new ApiResponse(200, { submission }, "Submission graded successfully."));
});

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  getSubmissions,
  getSubmissionById,
  gradeSubmission,
};
