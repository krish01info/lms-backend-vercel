const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const parentService = require("./parent.service");

const getMyChildren = asyncHandler(async (req, res) => {
  const children = await parentService.getMyChildren(req.user.id);
  res.status(200).json(new ApiResponse(200, { children }, "Children fetched successfully."));
});

const getChildSummary = asyncHandler(async (req, res) => {
  const summary = await parentService.getChildSummary(req.user.id, req.params.studentId);
  res.status(200).json(new ApiResponse(200, summary, "Child summary fetched successfully."));
});

module.exports = { getMyChildren, getChildSummary };
