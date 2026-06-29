const multer = require("multer");
const path = require("path");
const { ApiError } = require("../utils/ApiError");

// ─── Storage: memory (stream to S3 / Supabase Storage) ───────────────────────
const memoryStorage = multer.memoryStorage();

// ─── Storage: disk (local dev fallback) ──────────────────────────────────────
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // ensure this folder exists or is created on start
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

// ─── File filter factories ────────────────────────────────────────────────────

/** Allow only image files (JPEG, PNG, WEBP, GIF) */
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new ApiError(400, "Only image files (JPEG, PNG, WEBP, GIF) are allowed"));
};

/** Allow only video files (MP4, MOV, MKV, WEBM) */
const videoFilter = (req, file, cb) => {
  const allowed = /mp4|mov|mkv|webm/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = /video/.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new ApiError(400, "Only video files (MP4, MOV, MKV, WEBM) are allowed"));
};

/** Allow docs + images (PDF, DOCX, DOC, PNG, JPEG, ZIP) */
const documentFilter = (req, file, cb) => {
  const allowed = /pdf|docx|doc|png|jpeg|jpg|zip/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  if (extOk) return cb(null, true);
  cb(
    new ApiError(
      400,
      "Allowed file types: PDF, DOCX, DOC, PNG, JPEG, ZIP"
    )
  );
};

// ─── Multer instance builder ──────────────────────────────────────────────────
const buildUploader = ({ filter, maxSizeMB = 5, useMemory = true }) =>
  multer({
    storage: useMemory ? memoryStorage : diskStorage,
    fileFilter: filter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  });

// ─── Named uploaders ──────────────────────────────────────────────────────────

/**
 * Upload a single avatar image.
 * Field name: "avatar"
 * Max size  : 2 MB
 */
const uploadAvatar = buildUploader({
  filter: imageFilter,
  maxSizeMB: 2,
}).single("avatar");

/**
 * Upload a course thumbnail image.
 * Field name: "thumbnail"
 * Max size  : 5 MB
 */
const uploadCourseThumbnail = buildUploader({
  filter: imageFilter,
  maxSizeMB: 5,
}).single("thumbnail");

/**
 * Upload a single lesson video.
 * Field name: "video"
 * Max size  : 500 MB
 */
const uploadLessonVideo = buildUploader({
  filter: videoFilter,
  maxSizeMB: 500,
}).single("video");

/**
 * Upload an assignment submission file.
 * Field name: "submission"
 * Max size  : 20 MB
 * Accepts  : PDF, DOCX, DOC, images, ZIP
 */
const uploadSubmission = buildUploader({
  filter: documentFilter,
  maxSizeMB: 20,
}).single("submission");

/**
 * Upload multiple course resource files (PDFs, images).
 * Field name: "resources"
 * Max files : 10
 * Max size  : 10 MB each
 */
const uploadCourseResources = buildUploader({
  filter: documentFilter,
  maxSizeMB: 10,
}).array("resources", 10);

// ─── Multer error wrapper ─────────────────────────────────────────────────────
/**
 * Wraps a multer upload function and converts MulterErrors into ApiErrors
 * so the global error handler can format them properly.
 *
 * Usage in routes:
 *   router.post("/avatar", handleUpload(uploadAvatar), controller.updateAvatar);
 */
const handleUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(413, "File too large. Check the size limit for this upload type."));
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return next(new ApiError(400, "Too many files uploaded at once."));
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(new ApiError(400, `Unexpected field: "${err.field}". Check the field name.`));
    }
    if (err instanceof ApiError) return next(err);

    return next(new ApiError(500, `Upload error: ${err.message}`));
  });
};

module.exports = {
  uploadAvatar,
  uploadCourseThumbnail,
  uploadLessonVideo,
  uploadSubmission,
  uploadCourseResources,
  handleUpload,
};
