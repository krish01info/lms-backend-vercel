const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const { cloudinary } = require("../../utils/cloudinary");
const ApiResponse = require("../../utils/ApiResponse");

/**
 * GET /api/v1/uploads/sign-cloudinary
 * Generates a secure signature for direct frontend-to-Cloudinary uploads
 */
router.get("/sign-cloudinary", protect, (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = "learnflow/courses/videos";

  // Generate signature using Cloudinary API Secret
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
    },
    cloudinary.config().api_secret
  );

  return res.status(200).json(
    new ApiResponse(200, {
      signature,
      timestamp,
      cloudName: cloudinary.config().cloud_name,
      apiKey: cloudinary.config().api_key,
      folder,
    }, "Upload signature generated successfully.")
  );
});

module.exports = router;
