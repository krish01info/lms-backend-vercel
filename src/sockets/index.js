const { Server } = require("socket.io");
const { registerChatHandlers } = require("./chat.socket");
const config = require("../config");

let io = null;

/**
 * Initialize Socket.IO on the provided HTTP server.
 * Must be called after the server is created.
 */
function initializeSocketIO(httpServer) {
  if (io) return io; // already initialized

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server)
        if (!origin) return callback(null, true);
        // Allow localhost and Vercel deployments
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

  io.on("connection", (socket) => {
    registerChatHandlers(io, socket);
  });

  console.log("🔌 Socket.IO initialized");
  return io;
}

/**
 * Get the Socket.IO server instance (null if not yet initialized).
 */
function getIO() {
  return io;
}

module.exports = { initializeSocketIO, getIO };
