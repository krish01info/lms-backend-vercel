const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const controller = require("./notifications.controller");
const { listQuerySchema, notificationIdParamSchema } = require("./notifications.validation");

// All notification routes require a logged-in user — a notification is
// always scoped to req.user.id, nobody can read/edit anyone else's.
router.use(protect);

// GET /api/v1/notifications?page=1&limit=20&unread=true
router.get("/", validate(listQuerySchema, "query"), controller.getMyNotifications);

// GET /api/v1/notifications/unread-count
router.get("/unread-count", controller.getUnreadCount);

// POST /api/v1/notifications/test — TEMP: manually trigger a live notification
router.post("/test", controller.testNotification);

// PATCH /api/v1/notifications/read-all
router.patch("/read-all", controller.markAllAsRead);

// PATCH /api/v1/notifications/:notificationId/read
router.patch(
  "/:notificationId/read",
  validate(notificationIdParamSchema, "params"),
  controller.markAsRead
);

// DELETE /api/v1/notifications/:notificationId
router.delete(
  "/:notificationId",
  validate(notificationIdParamSchema, "params"),
  controller.deleteNotification
);

module.exports = router;