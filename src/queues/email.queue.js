const config = require("../config");
const { sendMail } = require("../utils/mailer");

/**
 * Email queue — in serverless environments (Vercel) where Redis isn't
 * available, this falls back to synchronous sendMail(). When Redis IS
 * available, Bull provides async job processing with retries.
 *
 * Callers should always call `enqueueEmail()` regardless — the implementation
 * adapts to the runtime environment automatically.
 */
let emailQueue = null;

// Check if Redis is configured and reachable before spinning up Bull queue
(async () => {
  try {
    const Queue = require("bull");
    emailQueue = new Queue("email", {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
      },
    });

    // Register the error handler BEFORE isReady() — Bull starts connecting
    // immediately on construction; if Redis is down the error fires before
    // isReady() settles and needs a handler attached to not hit the default.
    emailQueue.on("error", (err) => {
      // Bull handles reconnection internally — just log so we know.
      console.log("📧 email queue note:", err.message);
    });

    await emailQueue.isReady();
    console.log("📧 Bull email queue initialized (Redis connected)");
  } catch (err) {
    // Redis is unavailable (not configured, wrong host, refused, etc.)
    emailQueue = null;
    console.log("📧 Redis unavailable — emails sent synchronously");
  }
})();

/**
 * Enqueue an email for sending. Falls back to synchronous sendMail()
 * when Redis/Bull is not available (serverless environments).
 */
const enqueueEmail = async (data) => {
  if (emailQueue) {
    return emailQueue.add(data, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
  }
  // Fallback: send synchronously — callers are expected to add .catch(() => {})
  return sendMail(data);
};

module.exports = { emailQueue, enqueueEmail };
