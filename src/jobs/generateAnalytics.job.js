const { runAnalyticsSnapshot } = require("../workers/analytics.worker");

/** Wraps the worker with job-level error handling so a failed run never crashes the scheduler. */
const generateAnalyticsJob = async () => {
  try {
    await runAnalyticsSnapshot();
  } catch (err) {
    console.error("❌ generateAnalytics job failed:", err.message);
  }
};

module.exports = generateAnalyticsJob;
