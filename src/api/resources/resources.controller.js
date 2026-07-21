const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ResourceService = require("./resources.service");

// GET /api/v1/courses/:courseId/resources
const getResources = asyncHandler(async (req, res) => {
  const resources = await ResourceService.listResources(
    req.params.courseId,
    req.user.id,
    req.user.role
  );
  return res.status(200).json(new ApiResponse(200, { resources }, "Resources fetched successfully."));
});

// POST /api/v1/courses/:courseId/resources
const postResources = asyncHandler(async (req, res) => {
  const resources = await ResourceService.uploadResources(
    req.params.courseId,
    req.files,
    req.user.id,
    req.user.role
  );
  return res.status(201).json(new ApiResponse(201, { resources }, "Resources uploaded successfully."));
});

// DELETE /api/v1/resources/:id
const removeResource = asyncHandler(async (req, res) => {
  const result = await ResourceService.deleteResource(req.params.id, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, result, "Resource deleted successfully."));
});

module.exports = { getResources, postResources, removeResource };
