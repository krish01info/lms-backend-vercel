// code here
const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const NotificationController = require("./notifications.controller");

// All notification routes require login — no role restriction (any role can have notifications)
router.get("/",            protect, NotificationController.getMyNotifications);
router.patch("/read-all",  protect, NotificationController.markAllAsRead);
router.patch("/:id/read",  protect, NotificationController.markAsRead);
router.delete("/:id",      protect, NotificationController.deleteNotification);

module.exports = router;