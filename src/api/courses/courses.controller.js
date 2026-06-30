const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const CourseService = require("./courses.service");

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
  const { title, description, price, categoryId, category, status, videoUrl } = req.body;
  const course = await CourseService.createCourse({
    title,
    description,
    price,
    categoryId,
    category,
    instructorId: req.user.id,
    status,
    videoUrl
  });
  return res.status(201).json(new ApiResponse(201, { course }, "Course created successfully."));
});

module.exports = { getCourses, getCourseById, getMyCourses, getEnrolledCourses, createCourse };
