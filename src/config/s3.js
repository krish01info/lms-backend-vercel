const config = require("./index");

/**
 * Optional AWS S3 client. The app's primary file storage is Cloudinary
 * (see utils/cloudinary.js) — this exists for deployments that prefer S3
 * for large files (e.g. lesson videos) instead. Only initializes if AWS
 * credentials are actually set, so it's a safe no-op everywhere else.
 */
let s3Client = null;

const getS3Client = () => {
  if (!config.s3.accessKeyId || !config.s3.bucket) return null;
  if (s3Client) return s3Client;

  // Lazy require — avoids forcing @aws-sdk/client-s3 as a hard dependency
  // for deployments that never touch S3.
  const { S3Client } = require("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: config.s3.region,
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
  });
  return s3Client;
};

module.exports = { getS3Client, bucket: config.s3.bucket };
