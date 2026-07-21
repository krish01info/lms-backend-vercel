const Queue = require("bull");
const config = require("../config");

/**
 * Video processing queue — lesson video uploads are large; transcoding /
 * thumbnail generation / duration extraction happens here asynchronously so
 * the upload request returns immediately. Processed by src/workers/video.worker.js.
 */
let videoQueue = null;
try {
  videoQueue = new Queue("video-processing", {
    redis: { host: config.redis.host, port: config.redis.port, password: config.redis.password || undefined },
  });
  videoQueue.on("error", (err) => console.error("❌ video queue error:", err.message));
} catch (err) {
  console.warn("⚠️  video queue disabled:", err.message);
}

/** data: { lessonId, sourceUrl } */
const enqueueVideoProcessing = async (data) => {
  if (!videoQueue) return null;
  return videoQueue.add(data, { attempts: 2 });
};

module.exports = { videoQueue, enqueueVideoProcessing };
