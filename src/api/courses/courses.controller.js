const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const CourseService = require("./courses.service");
const ROLES = require("../../constants/roles");

// GET /api/v1/courses
const getCourses = asyncHandler(async (req, res) => {
  const { search, categoryId, page, limit } = req.query;
  const result = await CourseService.getCourses({ search, categoryId, page, limit });
  return res.status(200).json(new ApiResponse(200, result, "Courses fetched successfully."));
});

// GET /api/v1/courses/enrolled
const getEnrolledCourses = asyncHandler(async (req, res) => {
  const courses = await CourseService.getEnrolledCourses(req.user.id);
  return res.status(200).json(new ApiResponse(200, { courses }, "Enrolled courses fetched."));
});

// GET /api/v1/courses/my
const getMyCourses = asyncHandler(async (req, res) => {
  const courses = await CourseService.getMyCourses(req.user.id);
  return res.status(200).json(new ApiResponse(200, { courses }, "Your courses fetched."));
});

// GET /api/v1/courses/:id
const getCourseById = asyncHandler(async (req, res) => {
  const course = await CourseService.getCourseById(req.params.id);
  return res.status(200).json(new ApiResponse(200, { course }, "Course fetched successfully."));
});

// POST /api/v1/courses
const createCourse = asyncHandler(async (req, res) => {
  const { title, description, price, categoryId, category, status, videoUrl, thumbnail } = req.body;
  const course = await CourseService.createCourse({
    title,
    description,
    price,
    categoryId,
    category,
    instructorId: req.user.id,
    status,
    videoUrl,
    thumbnail,
  });
  return res.status(201).json(new ApiResponse(201, { course }, "Course created successfully."));
});

// PATCH /api/v1/courses/:id — update course details
const updateCourse = asyncHandler(async (req, res) => {
  const course = await CourseService.updateCourse(
    req.params.id,
    req.body,
    req.user.id,
    req.user.role
  );
  return res.status(200).json(new ApiResponse(200, { course }, "Course updated successfully."));
});

// PATCH /api/v1/courses/:id/status — change course status (DRAFT | PUBLISHED | ARCHIVED)
const updateCourseStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const isAdmin = req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;
  const course = await CourseService.updateCourseStatus(
    req.params.id,
    req.user.id,
    status,
    isAdmin
  );
  return res.status(200).json(new ApiResponse(200, { course }, `Course status updated to ${status}.`));
});

// DELETE /api/v1/courses/:id — delete a course
const deleteCourse = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;
  await CourseService.deleteCourse(req.params.id, req.user.id, isAdmin);
  return res.status(200).json(new ApiResponse(200, null, "Course deleted successfully."));
});

module.exports = {
  getCourses,
  getCourseById,
  getMyCourses,
  getEnrolledCourses,
  createCourse,
  updateCourse,
  updateCourseStatus,
  deleteCourse,
};
