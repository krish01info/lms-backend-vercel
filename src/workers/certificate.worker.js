const { certificateQueue } = require("../queues/certificate.queue");
const certificatesService = require("../api/certificates/certificates.service");

/**
 * Processes certificate generation jobs. PDF rendering itself isn't wired to
 * a template engine yet — this issues the certificate record so the rest of
 * the flow (student sees it under "My Certificates") works end-to-end; a
 * PDF renderer can populate `fileUrl` for real later without any caller changes.
 */
const startCertificateWorker = () => {
  if (!certificateQueue) return;
  certificateQueue.process(3, async (job) => {
    const { userId, courseId } = job.data;
    return certificatesService.issueCertificate({ userId, courseId, fileUrl: null });
  });
  certificateQueue.on("completed", (job) => console.log(`✅ certificate issued — job ${job.id}`));
  certificateQueue.on("failed", (job, err) => console.error(`❌ certificate job ${job.id} failed:`, err.message));
  console.log("👷 certificate worker listening");
};

module.exports = { startCertificateWorker };
