const Queue = require("bull");
const config = require("../config");

/**
 * Async email queue — anything that used to call sendMail() inline
 * (welcome emails, notifications, receipts) pushes a job here instead so a
 * slow SMTP call never blocks the request/response cycle. Processed by
 * src/workers/email.worker.js.
 *
 * Falls back to null when Redis isn't configured (e.g. local dev without
 * Redis running) — callers should check `emailQueue` truthiness, or just
 * call the mailer util directly in that case.
 */
let emailQueue = null;
try {
  emailQueue = new Queue("email", {
    redis: { host: config.redis.host, port: config.redis.port, password: config.redis.password || undefined },
  });
  emailQueue.on("error", (err) => console.error("❌ email queue error:", err.message));
} catch (err) {
  console.warn("⚠️  email queue disabled:", err.message);
}

/** data: { to, subject, html?, text? } */
const enqueueEmail = async (data) => {
  if (!emailQueue) return null;
  return emailQueue.add(data, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
};

module.exports = { emailQueue, enqueueEmail };
