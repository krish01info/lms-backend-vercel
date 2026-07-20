// code here
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const config = require("../config");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
  });

  // Every socket connection must present a valid access token
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Authentication token missing"));

      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.userId = decoded.id;

      if (!socket.userId) return next(new Error("Invalid token payload"));
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
    if (config.env !== "test") {
      console.log(`🔌 Socket connected: user ${socket.userId}`);
    }

    socket.on("disconnect", () => {
      if (config.env !== "test") {
        console.log(`🔌 Socket disconnected: user ${socket.userId}`);
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized. Call initSocket(server) first.");
  return io;
};

const emitToUser = (userId, event, payload) => {
  if (!io) return; // no-op if sockets aren't initialized (e.g. tests)
  io.to(`user:${userId}`).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToUser };