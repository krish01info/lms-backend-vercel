const app = require("../src/app");
const { connectDB } = require("../src/config/database");

// ─── Lazy Database Connection (Serverless-Safe) ─────────────────────────────
// Uses a mutex (connectingPromise) to prevent multiple concurrent cold starts
// from all trying to connect to the database simultaneously.
let isConnected = false;
let connectingPromise = null;

app.use(async (req, res, next) => {
  if (isConnected) return next();

  if (connectingPromise) {
    // Another request is already connecting — wait for it
    try {
      await connectingPromise;
      return next();
    } catch (err) {
      return res.status(500).json({ error: "Database connection failed" });
    }
  }

  connectingPromise = (async () => {
    await connectDB();
    isConnected = true;
  })();

  try {
    await connectingPromise;
    next();
  } catch (err) {
    console.error("Database lazy connection failed:", err.message);
    connectingPromise = null; // allow retry on next request
    return res.status(500).json({ error: "Database connection failed" });
  }
});

module.exports = app;
