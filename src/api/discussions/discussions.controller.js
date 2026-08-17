const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const discussionsService = require("./discussions.service");

const getThreads = asyncHandler(async (req, res) => {
  const { courseId, search, page, limit } = req.query;
  const result = await discussionsService.getThreads({
    courseId,
    search,
    page,
    limit,
    userId: req.user.id,
    role: req.user.role,
  });
  res.status(200).json(new ApiResponse(200, result, "Threads fetched successfully."));
});

const getThreadById = asyncHandler(async (req, res) => {
  const thread = await discussionsService.getThreadById(req.params.id, req.user.id, req.user.role);
  res.status(200).json(new ApiResponse(200, { thread }, "Thread fetched successfully."));
});

const createThread = asyncHandler(async (req, res) => {
  const thread = await discussionsService.createThread(req.body, req.user.id, req.user.role);
  res.status(201).json(new ApiResponse(201, { thread }, "Thread created successfully."));
});

const addReply = asyncHandler(async (req, res) => {
  const reply = await discussionsService.addReply(req.params.id, req.body.content, req.user.id, req.user.role);
  res.status(201).json(new ApiResponse(201, { reply }, "Reply added successfully."));
});

const toggleLike = asyncHandler(async (req, res) => {
  const result = await discussionsService.toggleLike(req.params.id, req.user.id, req.user.role);
  res.status(200).json(new ApiResponse(200, result, result.liked ? "Thread liked." : "Like removed."));
});

const deleteThread = asyncHandler(async (req, res) => {
  const result = await discussionsService.deleteThread(req.params.id, req.user.id, req.user.role);
  res.status(200).json(new ApiResponse(200, result, "Thread deleted successfully."));
});

const setPinned = asyncHandler(async (req, res) => {
  const thread = await discussionsService.setPinned(req.params.id, req.body.pinned);
  res.status(200).json(new ApiResponse(200, { thread }, "Thread updated successfully."));
});

module.exports = {
  getThreads,
  getThreadById,
  createThread,
  addReply,
  toggleLike,
  deleteThread,
  setPinned,
};