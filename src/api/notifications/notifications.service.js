const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

const notificationSelect = {
  id: true,
  title: true,
  message: true,
  isRead: true,
  type: true,
  createdAt: true,
};

// GET /notifications/me?page=&limit=&unreadOnly=
const getMyNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { userId, ...(unreadOnly && { isRead: false }) };

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

// GET /notifications/unread-count
const getUnreadCount = async (userId) => {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { count };
};

// PATCH /notifications/:id/read
const markAsRead = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new ApiError(404, "Notification not found.");
  if (notification.userId !== userId) {
    throw new ApiError(403, "You do not have permission to modify this notification.");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
    select: notificationSelect,
  });
};

// PATCH /notifications/read-all
const markAllAsRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { count: result.count };
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER — not exposed via any route. Other modules (e.g.
// announcements.service.js) import this directly to fan out notifications
// to a batch of users in one call.
// ─────────────────────────────────────────────────────────────────────────────
const createNotificationsForUsers = async (userIds, { title, message, type = "GENERAL" }) => {
  if (userIds.length === 0) return { count: 0 };

  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, title, message, type })),
  });

  return { count: result.count };
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotificationsForUsers,
};
