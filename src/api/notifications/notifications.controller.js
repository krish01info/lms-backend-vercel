const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_STATUS = require("../../constants/httpStatus");
const NotificationService = require("./notifications.service");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/notifications
// List the logged-in user's notifications (paginated).
// Query: ?page=1&limit=20&unread=true
// ─────────────────────────────────────────────────────────────────────────────
const getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unread } = req.query;

  const result = await NotificationService.getUserNotifications(req.user.id, {
    page,
    limit,
    unreadOnly: unread === "true",
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, "Notifications fetched successfully")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/notifications/unread-count
// Just the badge count — cheap endpoint the frontend can poll often.
// ─────────────────────────────────────────────────────────────────────────────
const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await NotificationService.getUnreadCount(req.user.id);

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, "Unread count fetched successfully")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/notifications/:notificationId/read
// Mark a single notification as read.
// ─────────────────────────────────────────────────────────────────────────────
const markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const notification = await NotificationService.markAsRead(notificationId, req.user.id);

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, notification, "Notification marked as read")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/notifications/read-all
// Mark every unread notification as read.
// ─────────────────────────────────────────────────────────────────────────────
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await NotificationService.markAllAsRead(req.user.id);

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, "All notifications marked as read")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/notifications/:notificationId
// ─────────────────────────────────────────────────────────────────────────────
const deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const result = await NotificationService.remove(notificationId, req.user.id);

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, "Notification deleted")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/notifications/test
// TEMP: manually fire a notification at yourself to confirm the live
// Socket.IO push works end-to-end. Remove once real triggers (enrollment,
// payment, etc.) are wired up.
// ─────────────────────────────────────────────────────────────────────────────
const testNotification = asyncHandler(async (req, res) => {
  const { title, message, type } = req.body;

  const notification = await NotificationService.create({
    userId: req.user.id,
    title: title || "Test notification",
    message: message || "This is a test push from Postman.",
    type: type || "GENERAL",
  });

  return res.status(201).json(
    new ApiResponse(201, notification, "Test notification created and pushed live")
  );
});

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  testNotification,
};