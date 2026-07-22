const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const LessonService = require("./lessons.service");

// GET /api/v1/courses/:courseId/lessons
const getLessons = asyncHandler(async (req, res) => {
  const lessons = await LessonService.getLessons(req.params.courseId);
  return res.status(200).json(new ApiResponse(200, { lessons }, "Lessons fetched successfully."));
});

// GET /api/v1/courses/:courseId/lessons/:lessonId
const getLessonById = asyncHandler(async (req, res) => {
  const lesson = await LessonService.getLessonById(req.params.courseId, req.params.lessonId);
  return res.status(200).json(new ApiResponse(200, { lesson }, "Lesson fetched successfully."));
});

// POST /api/v1/courses/:courseId/lessons
const createLesson = asyncHandler(async (req, res) => {
  const lesson = await LessonService.createLesson(req.params.courseId, req.body, req.user.id, req.user.role);
  return res.status(201).json(new ApiResponse(201, { lesson }, "Lesson created successfully."));
});

// PATCH /api/v1/courses/:courseId/lessons/:lessonId
const updateLesson = asyncHandler(async (req, res) => {
  const lesson = await LessonService.updateLesson(req.params.courseId, req.params.lessonId, req.body, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, { lesson }, "Lesson updated successfully."));
});

// DELETE /api/v1/courses/:courseId/lessons/:lessonId
const deleteLesson = asyncHandler(async (req, res) => {
  const result = await LessonService.deleteLesson(req.params.courseId, req.params.lessonId, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, result, "Lesson deleted successfully."));
});

// POST /api/v1/courses/:courseId/lessons/reorder
const reorderLessons = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;
  const result = await LessonService.reorderLessons(req.params.courseId, orderedIds, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, result, "Lessons reordered successfully."));
});

module.exports = { getLessons, getLessonById, createLesson, updateLesson, deleteLesson, reorderLessons };
