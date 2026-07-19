const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const AiTutorService = require("./aiTutor.service");

const uploadDocument = asyncHandler(async (req, res) => {
  const document = await AiTutorService.uploadAndIndexPdf({
    file: req.file,
    userId: req.user.id,
    title: req.body.title,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { document }, "PDF uploaded and indexed successfully."));
});

const listDocuments = asyncHandler(async (req, res) => {
  const documents = await AiTutorService.listDocuments(req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, { documents }, "AI Tutor documents fetched successfully."));
});

const deleteDocument = asyncHandler(async (req, res) => {
  const document = await AiTutorService.deleteDocument({
    documentId: req.params.documentId,
    user: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { document }, "AI Tutor document deleted successfully."));
});

const chat = asyncHandler(async (req, res) => {
  const { question, documentIds, topK } = req.body;
  const result = await AiTutorService.askQuestion({
    question,
    documentIds,
    topK,
    userId: req.user.id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "AI Tutor response generated successfully."));
});

module.exports = {
  uploadDocument,
  listDocuments,
  deleteDocument,
  chat,
};
