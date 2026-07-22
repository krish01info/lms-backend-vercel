const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const QuizService = require("./quizzes.service");

// POST /api/v1/quizzes
const createQuiz = asyncHandler(async (req, res) => {
  const { title, courseId, timeLimit, passMark } = req.body;

  const quiz = await QuizService.createQuiz({
    title,
    courseId,
    timeLimit,
    passMark,
    userId: req.user.id,
    role: req.user.role,
  });

  return res.status(201).json(new ApiResponse(201, { quiz }, "Quiz created successfully."));
});

// GET /api/v1/quizzes/my — quizzes for the student's enrolled courses
const getMyQuizzes = asyncHandler(async (req, res) => {
  const result = await QuizService.getMyQuizzes(req.user.id);
  return res.status(200).json(new ApiResponse(200, result, "My quizzes fetched successfully."));
});

// GET /api/v1/quizzes
const getQuizzes = asyncHandler(async (req, res) => {
  const { courseId, page, limit } = req.query;

  const result = await QuizService.getQuizzes({
    courseId,
    page,
    limit,
    role: req.user?.role,
  });

  return res.status(200).json(new ApiResponse(200, result, "Quizzes fetched successfully."));
});

// GET /api/v1/quizzes/:id
const getQuizById = asyncHandler(async (req, res) => {
  const quiz = await QuizService.getQuizById(req.params.id);

  return res.status(200).json(new ApiResponse(200, { quiz }, "Quiz fetched successfully."));
});

// PATCH /api/v1/quizzes/:id
const updateQuiz = asyncHandler(async (req, res) => {
  const { title, timeLimit, passMark } = req.body;

  const quiz = await QuizService.updateQuiz(
    req.params.id,
    { title, timeLimit, passMark },
    req.user.id,
    req.user.role
  );

  return res.status(200).json(new ApiResponse(200, { quiz }, "Quiz updated successfully."));
});

// DELETE /api/v1/quizzes/:id
const deleteQuiz = asyncHandler(async (req, res) => {
  await QuizService.deleteQuiz(req.params.id, req.user.id, req.user.role);

  return res.status(200).json(new ApiResponse(200, null, "Quiz deleted successfully."));
});

module.exports = { createQuiz, getQuizzes, getMyQuizzes, getQuizById, updateQuiz, deleteQuiz };
