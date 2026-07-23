const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const certificatesService = require("./certificates.service");

const getMyCertificates = asyncHandler(async (req, res) => {
  const certificates = await certificatesService.getMyCertificates(req.user.id);
  res.status(200).json(new ApiResponse(200, { certificates }, "Certificates fetched successfully."));
});

const getCertificateById = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.getCertificateById(req.params.id, req.user.id);
  res.status(200).json(new ApiResponse(200, { certificate }, "Certificate fetched successfully."));
});

const issueCertificate = asyncHandler(async (req, res) => {
  const { userId, courseId, fileUrl } = req.body;
  const certificate = await certificatesService.issueCertificate({ userId, courseId, fileUrl });
  res.status(201).json(new ApiResponse(201, { certificate }, "Certificate issued successfully."));
});

module.exports = { getMyCertificates, getCertificateById, issueCertificate };
