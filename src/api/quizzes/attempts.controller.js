const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const AttemptService = require("./attempts.service");

// POST /api/v1/quizzes/:quizId/attempts
const submitAttempt = asyncHandler(async (req, res) => {
  const result = await AttemptService.submitAttempt(
    req.params.quizId,
    req.user.id,
    req.body.answers
  );

  return res
    .status(201)
    .json(new ApiResponse(201, result, "Quiz submitted and graded successfully."));
});

// GET /api/v1/quizzes/:quizId/attempts/me
const getMyAttempt = asyncHandler(async (req, res) => {
  const result = await AttemptService.getMyAttempt(
    req.params.quizId,
    req.user.id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Attempt fetched successfully."));
});

// GET /api/v1/quizzes/:quizId/attempts
const getAttemptsForQuiz = asyncHandler(async (req, res) => {
  const result = await AttemptService.getAttemptsForQuiz(
    req.params.quizId,
    req.user.id,
    req.user.role
  );

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Attempts fetched successfully."));
});

module.exports = { submitAttempt, getMyAttempt, getAttemptsForQuiz };
