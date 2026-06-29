const express = require("express");
const router = express.Router({ mergeParams: true }); // inherit :sectionId from parent
const { handleUpload, uploadLessonVideo } = require("../../middleware/upload.middleware");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/sections/:sectionId/lessons/:lessonId/video
// Upload a lesson video; it will be queued for HLS transcoding
// Field : video  (MP4 | MOV | MKV | WEBM — max 500 MB)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:lessonId/video",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  handleUpload(uploadLessonVideo),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(
        new ApiResponse(400, null, "No file received. Attach a video file with field name 'video'.")
      );
    }

    const { sectionId, lessonId } = req.params;

    // TODO:
    // 1. Upload raw video to S3: lessons/{lessonId}/raw/{filename}
    // 2. Enqueue transcoding job:
    //    await videoQueue.add("transcode", { lessonId, rawS3Key });
    // 3. Update lesson record: status = "PROCESSING"

    return res.status(202).json(
      new ApiResponse(202, {
        sectionId,
        lessonId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        status: "PROCESSING",
      }, "Video uploaded and queued for transcoding. It will be available shortly.")
    );
  })
);

module.exports = router;
