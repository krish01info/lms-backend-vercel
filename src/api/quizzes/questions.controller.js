const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const QuestionService = require("./questions.service");

// POST /api/v1/quizzes/:quizId/questions
const createQuestion = asyncHandler(async (req, res) => {
  const question = await QuestionService.createQuestion(
    req.params.quizId,
    req.body,
    req.user.id,
    req.user.role
  );
  return res
    .status(201)
    .json(new ApiResponse(201, { question }, "Question created successfully."));
});

// GET /api/v1/quizzes/:quizId/questions
const getQuestions = asyncHandler(async (req, res) => {
  const questions = await QuestionService.getQuestions(
    req.params.quizId,
    req.user.id,
    req.user.role
  );
  return res
    .status(200)
    .json(new ApiResponse(200, { questions }, "Questions fetched successfully."));
});

// PATCH /api/v1/questions/:id
const updateQuestion = asyncHandler(async (req, res) => {
  const question = await QuestionService.updateQuestion(
    req.params.id,
    req.body,
    req.user.id,
    req.user.role
  );
  return res
    .status(200)
    .json(new ApiResponse(200, { question }, "Question updated successfully."));
});

// DELETE /api/v1/questions/:id
const deleteQuestion = asyncHandler(async (req, res) => {
  await QuestionService.deleteQuestion(
    req.params.id,
    req.user.id,
    req.user.role
  );
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Question deleted successfully."));
});

module.exports = { createQuestion, getQuestions, updateQuestion, deleteQuestion };
