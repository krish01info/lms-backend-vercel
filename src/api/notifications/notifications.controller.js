// code here
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const NotificationService = require("./notifications.service");

// GET /api/v1/notifications
const getMyNotifications = asyncHandler(async (req, res) => {
  const { isRead, page, limit } = req.query;
  const result = await NotificationService.getMyNotifications(req.user.id, { isRead, page, limit });
  return res.status(200).json(new ApiResponse(200, result, "Notifications fetched."));
});

// PATCH /api/v1/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await NotificationService.markAsRead(req.params.id, req.user.id);
  return res.status(200).json(new ApiResponse(200, { notification }, "Notification marked as read."));
});

// PATCH /api/v1/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await NotificationService.markAllAsRead(req.user.id);
  return res.status(200).json(new ApiResponse(200, result, "All notifications marked as read."));
});

// DELETE /api/v1/notifications/:id
const deleteNotification = asyncHandler(async (req, res) => {
  const result = await NotificationService.deleteNotification(req.params.id, req.user.id);
  return res.status(200).json(new ApiResponse(200, result, "Notification deleted."));
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead, deleteNotification };