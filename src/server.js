const fs = require("fs");
const path = require("path");
const http = require("http");
const app = require("./app");
const config = require("./config");
const { connectDB } = require("./config/database");   // Prisma DB connection
const { initializeSocketIO } = require("./sockets");
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

  const httpServer = http.createServer(app);

  // Initialize Socket.IO for real-time messaging
  initializeSocketIO(httpServer);

  const PORT = config.port || 5000;

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 LMS API server running`);
    console.log(`   ► Local   : http://localhost:${PORT}`);
    console.log(`   ► Health  : http://localhost:${PORT}/health`);
    console.log(`   ► Env     : ${config.env}\n`);
  });
};

start().catch((err) => {
  console.error("❌ Failed to start server:", err.message);
  process.exit(1);
});
