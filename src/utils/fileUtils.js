const path = require("path");
const fs = require("fs");

/** Human-readable file size, e.g. 1536 -> "1.5 KB" */
const formatBytes = (bytes = 0) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

/** Lowercased file extension without the dot, e.g. "photo.PNG" -> "png" */
const getExtension = (filename = "") => path.extname(filename).replace(".", "").toLowerCase();

/** Collision-safe filename for disk storage. */
const generateUniqueFilename = (originalName = "file") => {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${unique}${path.extname(originalName)}`;
};

/** Best-effort delete of a local file (disk-storage fallback / cleanup after upload). */
const deleteLocalFile = async (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    console.error("⚠️  Failed to delete local file:", err.message);
    return false;
  }
};

module.exports = { formatBytes, getExtension, generateUniqueFilename, deleteLocalFile };
