const { prisma } = require("../config/database");
const { verifyAccessToken } = require("../utils/jwtUtils");
const MessageService = require("../api/messages/messages.service");

// In-memory map: userId -> Set<socketId> so we know who is online.
// In production this would live in Redis.
const onlineUsers = new Map();

function addUser(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
}

function removeUser(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
  }
}

function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

/**
 * Register chat-related socket events for a connected socket.
 *
 * The client is expected to pass the JWT in the `auth.token` handshake option:
 *   const socket = io("http://localhost:5000", { auth: { token } });
 */
function registerChatHandlers(io, socket) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.emit("error", { message: "Authentication required." });
    socket.disconnect();
    return;
  }

  let user;
  try {
    const decoded = verifyAccessToken(token);
    user = decoded;
  } catch {
    socket.emit("error", { message: "Invalid or expired token." });
    socket.disconnect();
    return;
  }

  const userId = user.id;
  addUser(userId, socket.id);

  // Join a personal room so we can emit events directly to this user
  socket.join(`user:${userId}`);

  // Broadcast online status
  socket.broadcast.emit("user:online", { userId, online: true });

  console.log(`[chat] User ${userId} connected (socket ${socket.id})`);

  // ─── Events ────────────────────────────────────────────────────────────

  // Join a conversation room
  socket.on("conversation:join", ({ conversationId }) => {
    if (!conversationId) return;
    socket.join(`conversation:${conversationId}`);
  });

  // Leave a conversation room
  socket.on("conversation:leave", ({ conversationId }) => {
    if (!conversationId) return;
    socket.leave(`conversation:${conversationId}`);
  });

  // Send a message (real-time) — delegates to the service for persistence
  socket.on("message:send", async ({ conversationId, content }, ack) => {
    if (!conversationId || !content?.trim()) {
      if (ack) ack({ error: "conversationId and content are required." });
      return;
    }

    try {
      // Use the same service method as the REST API to avoid duplication
      const message = await MessageService.sendMessage(conversationId, userId, content.trim());

      // Determine the other participant for notification
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { participant1Id: true, participant2Id: true },
      });
      const otherUserId =
        conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;

      // Emit to everyone in the conversation room
      io.to(`conversation:${conversationId}`).emit("message:new", message);

      // Notify the other user's personal room for badge updates
      io.to(`user:${otherUserId}`).emit("conversation:unread", {
        conversationId,
        senderId: userId,
      });

      if (ack) ack({ success: true, message });
    } catch (err) {
      console.error("[chat] message:send error:", err.message);
      if (ack) ack({ error: "Failed to send message." });
    }
  });

  // Mark messages as read
  socket.on("conversation:read", async ({ conversationId }, ack) => {
    if (!conversationId) return;

    try {
      const result = await MessageService.markAsRead(conversationId, userId);

      io.to(`conversation:${conversationId}`).emit("messages:read", {
        conversationId,
        readByUserId: userId,
        count: result.count,
      });

      if (ack) ack({ success: true, count: result.count });
    } catch (err) {
      console.error("[chat] conversation:read error:", err.message);
      if (ack) ack({ error: "Failed to mark as read." });
    }
  });

  // Typing indicator
  socket.on("typing:start", ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit("typing:start", {
      conversationId,
      userId,
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit("typing:stop", {
      conversationId,
      userId,
    });
  });

  // Check if specific users are online
  socket.on("users:online", ({ userIds }, ack) => {
    if (!Array.isArray(userIds) || !ack) return;
    const status = {};
    userIds.forEach((uid) => {
      status[uid] = isUserOnline(uid);
    });
    ack({ status });
  });

  // ─── Disconnect ────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    removeUser(userId, socket.id);
    socket.broadcast.emit("user:online", { userId, online: false });
    console.log(`[chat] User ${userId} disconnected (socket ${socket.id})`);
  });
}

// `isUserOnline` is exported for potential use by other socket modules.
module.exports = { registerChatHandlers, isUserOnline };
