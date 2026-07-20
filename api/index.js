const app = require("../src/app");
const { connectDB } = require("../src/config/database");

// Connect to database lazily before processing any request in serverless environment
let isConnected = false;
app.use(async (req, res, next) => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error("Database lazy connection failed:", err.message);
      return res.status(500).json({ error: "Database connection failed" });
    }
  }
  next();
});

module.exports = app;
