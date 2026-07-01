const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const EnrollmentService = require("./enrollments.service");
 
// POST /api/v1/enrollments
const enrollInCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.body;
  const enrollment = await EnrollmentService.enrollInCourse(req.user.id, courseId);
  return res.status(201).json(new ApiResponse(201, { enrollment }, "Enrolled successfully."));
});
 
// GET /api/v1/enrollments/my
const getMyEnrollments = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await EnrollmentService.getMyEnrollments(req.user.id, { status, page, limit });
  return res.status(200).json(new ApiResponse(200, result, "Your enrollments fetched."));
});
 
// GET /api/v1/enrollments/:id
const getEnrollmentById = asyncHandler(async (req, res) => {
  const enrollment = await EnrollmentService.getEnrollmentById(req.params.id, req.user);
  return res.status(200).json(new ApiResponse(200, { enrollment }, "Enrollment fetched."));
});
 
// DELETE /api/v1/enrollments/:id
const cancelEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await EnrollmentService.cancelEnrollment(req.params.id, req.user);
  return res.status(200).json(new ApiResponse(200, { enrollment }, "Enrollment cancelled."));
});
 
// GET /api/v1/enrollments (admin)
const getAllEnrollments = asyncHandler(async (req, res) => {
  const { status, courseId, userId, page, limit } = req.query;
  const result = await EnrollmentService.getAllEnrollments({ status, courseId, userId, page, limit });
  return res.status(200).json(new ApiResponse(200, result, "Enrollments fetched."));
});
 
module.exports = {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentById,
  cancelEnrollment,
  getAllEnrollments,
};