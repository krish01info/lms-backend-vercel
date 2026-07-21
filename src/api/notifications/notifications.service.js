const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const HTTP_STATUS = require("../../constants/httpStatus");
const { emitToUser } = require("../../sockets");

// ─────────────────────────────────────────────────────────────────────────────
// NotificationService
// Pure data-layer for the notifications table. This file is deliberately the
// ONLY place that touches `prisma.notification.*` — controllers call this,
// and so do the event listeners in src/events/notification.listeners.js.
//
// Every create also pushes live via Socket.IO (emitToUser) so connected
// clients get the notification instantly instead of having to poll.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a single notification for one user.
 * Called by the event listeners (e.g. on "payment.success").
 *
 * @param {Object} data
 * @param {string} data.userId
 * @param {string} data.title
 * @param {string} data.message
 * @param {string} [data.type] - one of prisma NotificationType (default GENERAL)
 * @param {string} [data.link] - optional deep-link target for the frontend
 * @param {Object} [data.meta] - optional structured payload
 */
const create = async ({ userId, title, message, type = "GENERAL", link, meta }) => {
  const notification = await prisma.notification.create({
    data: { userId, title, message, type, link, meta },
  });

  // Push live to the user if they're connected — no-ops safely if offline
  emitToUser(userId, "notification:new", notification);

  return notification;
};

/**
 * Create the same notification for many users at once (e.g. a course
 * announcement fanned out to every enrolled student).
 * Uses createMany for a single round-trip instead of N inserts.
 *
 * @param {string[]} userIds
 * @param {Object} data - { title, message, type, link, meta }
 */
const createMany = async (userIds, { title, message, type = "GENERAL", link, meta }) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return { count: 0 };

  // de-dupe in case a caller passes overlapping ids (e.g. instructor also enrolled)
  const uniqueIds = [...new Set(userIds)];

  const result = await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({ userId, title, message, type, link, meta })),
  });

  // createMany doesn't return the inserted rows, so we push a synthesized
  // payload to each recipient (createdAt is approximated as "now").
  const createdAt = new Date();
  uniqueIds.forEach((userId) => {
    emitToUser(userId, "notification:new", { userId, title, message, type, link, meta, createdAt });
  });

  return result;
};

/**
 * Paginated list of a user's notifications, newest first.
 * @param {string} userId
 * @param {Object} opts
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=20]
 * @param {boolean} [opts.unreadOnly=false]
 */
const getUserNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    items,
    unreadCount,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    },
  };
};

/**
 * Count of unread notifications — used for the little bell badge.
 */
const getUnreadCount = async (userId) => {
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
  return { unreadCount };
};

/**
 * Mark one notification as read/seen. Ownership-checked: a user can only
 * mark their own notifications, enforced via the compound where (id + userId)
 * rather than a separate findFirst + update round trip.
 */
const markAsRead = async (notificationId, userId) => {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });

  if (result.count === 0) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Notification not found.");
  }

  return prisma.notification.findUnique({ where: { id: notificationId } });
};

/**
 * Mark every unread notification for a user as read/seen (e.g. "mark all read" button).
 */
const markAllAsRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
};

/**
 * Delete a single notification (ownership-checked, same pattern as markAsRead).
 */
const remove = async (notificationId, userId) => {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });

  if (result.count === 0) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Notification not found.");
  }

  return { deleted: true };
};

module.exports = {
  create,
  createMany,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  remove,
};