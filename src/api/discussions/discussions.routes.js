const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");
const discussionsController = require("./discussions.controller");

// GET /api/v1/discussions?courseId=xxx&search=&page=&limit= — list threads for a course
router.get("/", protect, discussionsController.getThreads);

// GET /api/v1/discussions/:id — single thread with its replies
router.get("/:id", protect, discussionsController.getThreadById);

// POST /api/v1/discussions — create a new thread { courseId, title, content, tags }
router.post("/", protect, discussionsController.createThread);

// POST /api/v1/discussions/:id/replies — reply to a thread { content }
router.post("/:id/replies", protect, discussionsController.addReply);

// POST /api/v1/discussions/:id/like — toggle like for the current user
router.post("/:id/like", protect, discussionsController.toggleLike);

// DELETE /api/v1/discussions/:id — author, or instructor/admin/super_admin
router.delete("/:id", protect, discussionsController.deleteThread);

// PATCH /api/v1/discussions/:id/pin — pin/unpin { pinned: boolean } — instructor/admin only
router.patch(
  "/:id/pin",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  discussionsController.setPinned
);

module.exports = router;