const cloudinary = require("cloudinary").v2;
const config = require("../config");

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Uploads a file buffer (from Multer memoryStorage) directly to Cloudinary.
 *
 * @param {Buffer} fileBuffer - The file buffer from req.file.buffer
 * @param {string} folder - Target folder inside Cloudinary (e.g. 'avatars', 'courses', 'resources')
 * @param {string} [resourceType='auto'] - Type of resource: 'image', 'video', 'raw', or 'auto'
 * @returns {Promise<object>} Cloudinary upload response object
 */
const uploadToCloudinary = (fileBuffer, folder, resourceType = "auto", originalFilename) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `learnflow/${folder}`,
        resource_type: resourceType,
        // For "raw" files (PDFs, docs, etc.), Cloudinary needs the
        // extension present in the delivery URL itself to serve the
        // asset correctly — without this, uploads get a random public_id
        // with no extension, and delivery requests return HTTP 400.
        use_filename: true,
        unique_filename: true,
        filename_override: originalFilename,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload failed:", error);
          return reject(error);
        }
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
};
