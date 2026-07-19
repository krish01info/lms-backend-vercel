const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const { listQuerySchema, notificationIdParamSchema } = require("./notifications.validation");
const { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead } = require("./notifications.controller");

// GET /api/v1/notifications/me?page=&limit=&unreadOnly=
router.get("/me", protect, validate(listQuerySchema, "query"), getMyNotifications);

// GET /api/v1/notifications/unread-count
router.get("/unread-count", protect, getUnreadCount);

// PATCH /api/v1/notifications/:id/read
router.patch("/:id/read", protect, validate(notificationIdParamSchema, "params"), markAsRead);

// PATCH /api/v1/notifications/read-all
router.patch("/read-all", protect, markAllAsRead);

module.exports = router;