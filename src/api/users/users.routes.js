const express = require("express");
const router = express.Router();
const { handleUpload, uploadAvatar } = require("../../middleware/upload.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { protect } = require("../../middleware/auth.middleware");
const { getMe, updateMe } = require("./users.controller");

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

    // TODO: stream req.file.buffer → S3 / Supabase Storage and persist URL in DB
    // const avatarUrl = await uploadToStorage(req.file, "avatars");
    // await UserService.updateAvatar(req.user.id, avatarUrl);

    return res.status(200).json(
      new ApiResponse(200, {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      }, "Avatar uploaded successfully")
    );
  })
);

module.exports = router;
