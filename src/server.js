const fs = require("fs");
const path = require("path");
const http = require("http");
const app = require("./app");
const config = require("./config");
const { connectDB } = require("./config/database");   // Prisma DB connection
const { initializeSocketIO } = require("./sockets");  // Socket.IO (chat + live notifications)
const { startScheduler } = require("./jobs/scheduler"); // cron jobs + queue workers (email/video/certificate)
const { registerNotificationListeners } = require("./api/events/notification.listners");
// const { connectRedis } = require("./config/redis");   // enable when Redis is configured

// ─── Ensure uploads/ dir exists (local dev disk storage fallback) ─────────────
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Created uploads/ directory");
}

const start = async () => {
  await connectDB();      // connect to PostgreSQL via Prisma
  // await connectRedis();   // uncomment when Redis is ready
  registerNotificationListeners();
  startScheduler();       // background cron jobs + Bull queue workers (no-op without Redis)

  const PORT = config.port || 5000;

  const httpServer = http.createServer(app);

  // Initialize Socket.IO — powers both real-time chat/messaging and live
  // notification pushes.
  initializeSocketIO(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 LMS API server running`);
    console.log(`   ► Local   : http://localhost:${PORT}`);
    console.log(`   ► Health  : http://localhost:${PORT}/health`);
    console.log(`   ► Sockets : live on the same port`);
    console.log(`   ► Env     : ${config.env}\n`);
  });
};

start().catch((err) => {
  console.error("❌ Failed to start server:", err.message);
  process.exit(1);
});