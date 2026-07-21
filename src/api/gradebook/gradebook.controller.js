const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const GradebookService = require("./gradebook.service");

// GET /api/v1/gradebook/:courseId (instructor owner/admin)
const getGradebook = asyncHandler(async (req, res) => {
  const gradebook = await GradebookService.getGradebook(req.params.courseId, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, gradebook, "Gradebook fetched successfully."));
});

module.exports = { getGradebook };
