const express = require("express");
const { protect } = require("../../middleware/auth.middleware");
const {
  handleUpload,
  uploadAiTutorPdf,
} = require("../../middleware/upload.middleware");
const AiTutorController = require("./aiTutor.controller");

const router = express.Router();

router.post(
  "/documents",
  protect,
  handleUpload(uploadAiTutorPdf),
  AiTutorController.uploadDocument
);

router.get("/documents", protect, AiTutorController.listDocuments);

router.delete("/documents/:documentId", protect, AiTutorController.deleteDocument);

router.post("/chat", protect, AiTutorController.chat);

module.exports = router;
