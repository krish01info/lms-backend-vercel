const express = require("express");
const router = express.Router();
const { handleUpload, uploadAvatar } = require("../../middleware/upload.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");
const { getMe, updateMe, getMyTeachingStats } = require("./users.controller");

const { uploadToCloudinary } = require("../../utils/cloudinary");
const UserService = require("./users.service");
const { prisma } = require("../../config/database");

/**
 * @route   GET /api/v1/users/search?q=&role=&page=&limit=
 * @desc    Search users by name or email (instructors & admins only)
 */
router.get(
  "/search",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { q, role, page = 1, limit = 20 } = req.query;
    
    const where = {
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(role && { role }),
      isActive: true,
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, avatar: true },
        orderBy: { name: "asc" },
        skip,
        take: Number(limit),
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        users: users.map((u) => ({ ...u, role: u.role.toLowerCase() })),
        pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      }, "Users fetched successfully.")
    );
  })
);

// GET  /api/v1/users/me — fetch profile
router.get("/me", protect, getMe);

// PATCH /api/v1/users/me — update name / avatar url
router.patch("/me", protect, updateMe);

// GET /api/v1/users/me/teaching-stats — aggregate teaching activity
// (courses, students, quiz stats) for the instructor profile page
router.get(
  "/me/teaching-stats",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  getMyTeachingStats
);


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
