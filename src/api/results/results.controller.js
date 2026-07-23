const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const resultsService = require("./results.service");

const getMyResults = asyncHandler(async (req, res) => {
  const results = await resultsService.getMyResults(req.user.id);
  res.status(200).json(new ApiResponse(200, results, "Results fetched successfully."));
});

module.exports = { getMyResults };
