const { Server } = require("socket.io");
const { verifyAccessToken } = require("../utils/jwtUtils");
const { registerChatHandlers } = require("./chat.socket");
const config = require("../config");

let io = null;

/**
 * Initialize Socket.IO on the provided HTTP server.
 * Must be called after the server is created.
 *
 * This combines two things that were built independently on different
 * branches:
 *  - A JWT-authenticated connection handshake + a personal `user:<id>` room
 *    for every connected socket, which `emitToUser()` uses to push live
 *    notifications.
 *  - Real-time chat/messaging events (conversations, typing, read
 *    receipts), registered per-socket via `registerChatHandlers`.
 *
 * Because authentication now happens once, up front, in the `io.use()`
 * middleware below, `registerChatHandlers` no longer re-verifies the token
 * itself — it just reads `socket.userId`, which this middleware guarantees
 * is already set by the time `connection` fires.
 */
function initializeSocketIO(httpServer) {
  if (io) return io; // already initialized

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server)
        if (!origin) return callback(null, true);
        // Allow localhost and Vercel/Render deployments
        if (
          origin.startsWith("http://localhost") ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".render.com")
        ) {
          return callback(null, true);
        }
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Every socket connection must present a valid access token
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Authentication token missing"));

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;

      if (!socket.userId) return next(new Error("Invalid token payload"));
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    // Personal room used by emitToUser() for notification pushes, and by
    // the chat handlers for direct-message delivery / unread badges.
    socket.join(`user:${socket.userId}`);

    if (config.env !== "test") {
      console.log(`🔌 Socket connected: user ${socket.userId}`);
    }

    // Real-time chat/messaging handlers (conversations, typing, read receipts)
    registerChatHandlers(io, socket);

    socket.on("disconnect", () => {
      if (config.env !== "test") {
        console.log(`🔌 Socket disconnected: user ${socket.userId}`);
      }
    });
  });

  console.log("🔌 Socket.IO initialized");
  return io;
}

/**
 * Get the Socket.IO server instance. Throws if not yet initialized.
 */
function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initializeSocketIO(server) first.");
  }
  return io;
}

/**
 * Push an event directly to a single user's personal room.
 * No-ops if sockets haven't been initialized (e.g. in tests).
 */
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  initializeSocketIO,
  initSocket: initializeSocketIO, // alias — kept for code that used the notifications branch's name
  getIO,
  emitToUser,
};