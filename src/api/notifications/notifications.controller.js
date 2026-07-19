const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const NotificationService = require("./notifications.service");

// GET /api/v1/notifications/me?page=&limit=&unreadOnly=
const getMyNotifications = asyncHandler(async (req, res) => {
  const { page, limit, unreadOnly } = req.query;
  const result = await NotificationService.getMyNotifications(req.user.id, { page, limit, unreadOnly });
  return res.status(200).json(new ApiResponse(200, result, "Notifications fetched successfully."));
});

// GET /api/v1/notifications/unread-count
const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await NotificationService.getUnreadCount(req.user.id);
  return res.status(200).json(new ApiResponse(200, result, "Unread count fetched successfully."));
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

module.exports = { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead };
