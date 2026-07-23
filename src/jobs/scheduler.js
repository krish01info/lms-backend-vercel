const cron = require("node-cron");
const generateAnalyticsJob = require("./generateAnalytics.job");
const expireEnrollmentsJob = require("./expireEnrollments.job");
const { startEmailWorker } = require("../workers/email.worker");
const { startVideoWorker } = require("../workers/video.worker");
const { startCertificateWorker } = require("../workers/certificate.worker");

/**
 * Boots all background processing for the app: starts the Bull queue
 * workers (no-op if Redis isn't configured) and schedules the recurring
 * cron jobs. Call once from server.js after the DB connects.
 */
const startScheduler = () => {
  startEmailWorker();
  startVideoWorker();
  startCertificateWorker();

  // Every day at 02:00 — recompute the admin dashboard analytics snapshot.
  cron.schedule("0 2 * * *", generateAnalyticsJob);

  // Every hour — flip expired enrollments to EXPIRED so access checks stay accurate.
  cron.schedule("0 * * * *", expireEnrollmentsJob);

  console.log("🗓️  scheduler started (analytics: daily 02:00, enrollment expiry: hourly)");
};

module.exports = { startScheduler };
