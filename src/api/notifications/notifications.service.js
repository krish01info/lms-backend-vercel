// code here
const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

const notificationSelect = {
  id: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
};

// GET /api/v1/notifications — logged-in user's notifications
const getMyNotifications = async (userId, { isRead, page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    userId,
    ...(isRead !== undefined && { isRead: isRead === "true" }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// PATCH /api/v1/notifications/:id/read — mark one as read
const markAsRead = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) throw new ApiError(404, "Notification not found.");
  if (notification.userId !== userId)
    throw new ApiError(403, "You do not have permission to update this notification.");

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
    select: notificationSelect,
  });
};

// PATCH /api/v1/notifications/read-all — mark all as read
const markAllAsRead = async (userId) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return { updatedCount: count };
};

// DELETE /api/v1/notifications/:id — delete one notification
const deleteNotification = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) throw new ApiError(404, "Notification not found.");
  if (notification.userId !== userId)
    throw new ApiError(403, "You do not have permission to delete this notification.");

  await prisma.notification.delete({ where: { id: notificationId } });
  return { deleted: true };
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};