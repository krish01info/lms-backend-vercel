const express = require("express");
const router = express.Router();
const { handleUpload, uploadAvatar } = require("../../middleware/upload.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { protect } = require("../../middleware/auth.middleware");
const { getMe, updateMe } = require("./users.controller");

const { uploadToCloudinary } = require("../../utils/cloudinary");
const UserService = require("./users.service");

// GET  /api/v1/users/me — fetch profile
router.get("/me", protect, getMe);

// PATCH /api/v1/users/me — update name / avatar url
router.patch("/me", protect, updateMe);


/**
 * @route   PATCH /api/v1/users/me/avatar
 * @desc    Upload or replace the authenticated user's profile picture
 * @access  Private
 * @field   avatar  (image/jpeg, image/png, image/webp — max 2 MB)
 */
router.patch(
  "/me/avatar",
  protect,
  handleUpload(uploadAvatar),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(
        new ApiResponse(400, null, "No file received. Attach an image with field name 'avatar'.")
      );
    }

    // Stream req.file.buffer → Cloudinary and update avatar url in Supabase DB
    const uploadResult = await uploadToCloudinary(req.file.buffer, "avatars", "image");
    const updatedUser = await UserService.updateProfile(req.user.id, { avatar: uploadResult.secure_url });

    return res.status(200).json(
      new ApiResponse(200, {
        user: updatedUser,
        originalName: req.file.originalname,
        secureUrl: uploadResult.secure_url,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      }, "Avatar uploaded successfully")
    );
  })
);

module.exports = router;
