const { videoQueue } = require("../queues/video.queue");
const { prisma } = require("../config/database");

/**
 * Processes lesson video jobs. There's no real transcoding pipeline wired up
 * (that would mean ffmpeg + a media service) — this marks the lesson video
 * as processed and stores the source url as-is, keeping the queue/worker
 * contract real so a proper transcoder can be dropped in later without
 * touching any calling code.
 */
const startVideoWorker = () => {
  if (!videoQueue) return;
  videoQueue.process(2, async (job) => {
    const { lessonId, sourceUrl } = job.data;
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { videoUrl: sourceUrl },
    }).catch((err) => {
      throw new Error(`Failed updating lesson ${lessonId}: ${err.message}`);
    });
    return { lessonId, status: "processed" };
  });
  videoQueue.on("completed", (job) => console.log(`✅ video processed — lesson ${job.data.lessonId}`));
  videoQueue.on("failed", (job, err) => console.error(`❌ video job ${job.id} failed:`, err.message));
  console.log("👷 video worker listening");
};

module.exports = { startVideoWorker };
