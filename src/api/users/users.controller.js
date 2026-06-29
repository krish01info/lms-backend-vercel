const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const UserService = require("./users.service");

// GET /api/v1/users/me
const getMe = asyncHandler(async (req, res) => {
  const user = await UserService.getProfile(req.user.id);
  return res.status(200).json(new ApiResponse(200, { user }, "Profile fetched successfully."));
});

// PATCH /api/v1/users/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  const user = await UserService.updateProfile(req.user.id, { name, avatar });
  return res.status(200).json(new ApiResponse(200, { user }, "Profile updated successfully."));
});

module.exports = { getMe, updateMe };
