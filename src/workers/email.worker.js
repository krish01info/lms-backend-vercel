const { emailQueue } = require("../queues/email.queue");
const { sendMail } = require("../utils/mailer");

/** Registers the processor for the email queue. No-ops if the queue is disabled (no Redis). */
const startEmailWorker = () => {
  if (!emailQueue) return;
  emailQueue.process(5, async (job) => {
    const { to, subject, html, text } = job.data;
    await sendMail({ to, subject, html, text });
  });
  emailQueue.on("completed", (job) => console.log(`✅ email sent — job ${job.id} (${job.data.subject})`));
  emailQueue.on("failed", (job, err) => console.error(`❌ email job ${job.id} failed:`, err.message));
  console.log("👷 email worker listening");
};

module.exports = { startEmailWorker };
