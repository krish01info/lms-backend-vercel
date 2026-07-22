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

// ─── POST /api/v1/users/generate-parent-code ──────────────────────────────────
// Student generates a one-time 6-char alphanumeric invite code valid for 24h.
// The parent enters this code to link themselves to the student.
router.post(
  "/generate-parent-code",
  protect,
  requireRole(ROLES.STUDENT),
  asyncHandler(async (req, res) => {
    const { prisma } = require("../../config/database");

    // Generate a cryptographically random 6-char code (uppercase alphanumeric)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable chars (O/0, I/1)
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    await prisma.user.update({
      where: { id: req.user.id },
      data: { parentInviteCode: code, parentInviteExpiry: expiry },
    });

    return res.status(200).json(
      new ApiResponse(200, { code, expiresAt: expiry }, "Invite code generated successfully.")
    );
  })
);

// ─── GET /api/v1/users/parent-code ────────────────────────────────────────────
// Student fetches their current invite code (if valid and not expired).
router.get(
  "/parent-code",
  protect,
  requireRole(ROLES.STUDENT),
  asyncHandler(async (req, res) => {
    const { prisma } = require("../../config/database");

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { parentInviteCode: true, parentInviteExpiry: true },
    });

    const now = new Date();
    const isValid =
      user?.parentInviteCode &&
      user?.parentInviteExpiry &&
      user.parentInviteExpiry > now;

    if (!isValid) {
      return res.status(200).json(
        new ApiResponse(200, { code: null, expiresAt: null }, "No active invite code.")
      );
    }

    return res.status(200).json(
      new ApiResponse(200, {
        code: user.parentInviteCode,
        expiresAt: user.parentInviteExpiry,
      }, "Active invite code fetched.")
    );
  })
);

module.exports = router;

// ─── GET /api/v1/users/link-requests ──────────────────────────────────────────
// Student fetches all pending parent link requests they need to respond to.
const studentRouter = express.Router();

studentRouter.get(
  "/link-requests",
  protect,
  requireRole(ROLES.STUDENT),
  asyncHandler(async (req, res) => {
    const { prisma } = require("../../config/database");

    const requests = await prisma.parentLinkRequest.findMany({
      where: { childId: req.user.id, status: "PENDING" },
      include: {
        parent: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(
      new ApiResponse(200, { requests }, "Pending link requests fetched.")
    );
  })
);

// ─── POST /api/v1/users/link-requests/:requestId/respond ──────────────────────
// Student accepts or rejects a parent link request.
// Body: { action: "accept" | "reject" }
studentRouter.post(
  "/link-requests/:requestId/respond",
  protect,
  requireRole(ROLES.STUDENT),
  asyncHandler(async (req, res) => {
    const { prisma } = require("../../config/database");
    const { requestId } = req.params;
    const { action } = req.body;

    if (!["accept", "reject"].includes(action)) {
      throw new ApiError(400, "action must be 'accept' or 'reject'.");
    }

    const request = await prisma.parentLinkRequest.findUnique({
      where: { id: requestId },
      include: {
        parent: { select: { id: true, name: true } },
      },
    });

    if (!request) throw new ApiError(404, "Link request not found.");
    if (request.childId !== req.user.id) throw new ApiError(403, "You cannot respond to this request.");
    if (request.status !== "PENDING") throw new ApiError(400, "This request has already been responded to.");

    if (action === "accept") {
      // Create the confirmed link
      await prisma.parentChild.upsert({
        where: { parentId_childId: { parentId: request.parentId, childId: request.childId } },
        create: { parentId: request.parentId, childId: request.childId },
        update: {},
      });
      // Clear invite code (one-time use)
      await prisma.user.update({
        where: { id: req.user.id },
        data: { parentInviteCode: null, parentInviteExpiry: null },
      });
    }

    // Update request status
    await prisma.parentLinkRequest.update({
      where: { id: requestId },
      data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
    });

    const message = action === "accept"
      ? `You are now linked to ${request.parent.name}'s account.`
      : "Link request rejected.";

    return res.status(200).json(new ApiResponse(200, null, message));
  })
);

module.exports = { router, studentRouter };
