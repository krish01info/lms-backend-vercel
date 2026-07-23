const Queue = require("bull");
const config = require("../config");

/**
 * Certificate generation queue — rendering a PDF certificate is slow enough
 * (and non-critical-path) that it shouldn't happen inside the "course
 * completed" request. Processed by src/workers/certificate.worker.js, which
 * calls certificatesService.issueCertificate() once the PDF is ready.
 */
let certificateQueue = null;
try {
  certificateQueue = new Queue("certificate-generation", {
    redis: { host: config.redis.host, port: config.redis.port, password: config.redis.password || undefined },
  });
  certificateQueue.on("error", (err) => console.error("❌ certificate queue error:", err.message));
} catch (err) {
  console.warn("⚠️  certificate queue disabled:", err.message);
}

/** data: { userId, courseId } */
const enqueueCertificateGeneration = async (data) => {
  if (!certificateQueue) return null;
  return certificateQueue.add(data, { attempts: 3, backoff: { type: "exponential", delay: 10000 } });
};

module.exports = { certificateQueue, enqueueCertificateGeneration };
