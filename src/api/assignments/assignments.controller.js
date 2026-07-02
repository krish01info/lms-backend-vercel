// code here
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const AssignmentService = require("./assignments.service");
const { uploadToCloudinary } = require("../../utils/cloudinary");

// GET /api/v1/assignments
const getAssignments = asyncHandler(async (req, res) => {
  const { courseId, page, limit } = req.query;
  const result = await AssignmentService.getAssignments({ courseId, page, limit });
  return res.status(200).json(new ApiResponse(200, result, "Assignments fetched successfully."));
});

// GET /api/v1/assignments/my-submissions
const getMySubmissions = asyncHandler(async (req, res) => {
  const result = await AssignmentService.getMySubmissions(req.user.id, req.query);
  return res.status(200).json(new ApiResponse(200, result, "Your submissions fetched successfully."));
});

// GET /api/v1/assignments/:id
const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await AssignmentService.getAssignmentById(req.params.id);
  return res.status(200).json(new ApiResponse(200, { assignment }, "Assignment fetched successfully."));
});

// POST /api/v1/assignments
const createAssignment = asyncHandler(async (req, res) => {
  const { title, description, courseId, dueDate } = req.body;
  const assignment = await AssignmentService.createAssignment({
    title,
    description,
    courseId,
    dueDate,
    userId: req.user.id,
    role: req.user.role,
  });
  return res.status(201).json(new ApiResponse(201, { assignment }, "Assignment created successfully."));
});

// POST /api/v1/assignments/:assignmentId/submit
const submitAssignment = asyncHandler(async (req, res) => {
  let fileUrl = null;

  if (req.file) {
    const uploaded = await uploadToCloudinary(req.file.buffer, "submissions", "raw");
    fileUrl = uploaded.secure_url;
  }

  const submission = await AssignmentService.submitAssignment({
    assignmentId: req.params.assignmentId,
    userId: req.user.id,
    fileUrl,
    content: req.body.content || null,
  });

  return res.status(201).json(new ApiResponse(201, { submission }, "Assignment submitted successfully."));
});

// PATCH /api/v1/assignments/submissions/:submissionId/grade
const gradeSubmission = asyncHandler(async (req, res) => {
  const { grade, feedback } = req.body;
  const submission = await AssignmentService.gradeSubmission(
    req.params.submissionId,
    { grade: Number(grade), feedback },
    req.user.id,
    req.user.role
  );
  return res.status(200).json(new ApiResponse(200, { submission }, "Submission graded successfully."));
});

// GET /api/v1/assignments/:assignmentId/submissions
const getSubmissions = asyncHandler(async (req, res) => {
  const result = await AssignmentService.getSubmissions(
    req.params.assignmentId,
    req.user.id,
    req.user.role,
    req.query
  );
  return res.status(200).json(new ApiResponse(200, result, "Submissions fetched successfully."));
});

module.exports = {
  getAssignments,
  getAssignmentById,
  createAssignment,
  submitAssignment,
  gradeSubmission,
  getSubmissions,
  getMySubmissions,
};