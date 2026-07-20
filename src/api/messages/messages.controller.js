const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const MessageService = require("./messages.service");

// GET /api/v1/messages/conversations?page=&limit=
const listConversations = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await MessageService.listConversations(req.user.id, { page, limit });
  return res.status(200).json(new ApiResponse(200, result, "Conversations fetched successfully."));
});

// POST /api/v1/messages/conversations
const createConversation = asyncHandler(async (req, res) => {
  const { participantId } = req.body;
  const conversation = await MessageService.createConversation(req.user.id, participantId);
  return res.status(201).json(new ApiResponse(201, { conversation }, "Conversation created successfully."));
});

// GET /api/v1/messages/conversations/:conversationId/messages?page=&limit=
const listMessages = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await MessageService.listMessages(req.params.conversationId, req.user.id, { page, limit });
  return res.status(200).json(new ApiResponse(200, result, "Messages fetched successfully."));
});

// POST /api/v1/messages/conversations/:conversationId/messages
const sendMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const message = await MessageService.sendMessage(req.params.conversationId, req.user.id, content);
  return res.status(201).json(new ApiResponse(201, { message }, "Message sent successfully."));
});

// PATCH /api/v1/messages/conversations/:conversationId/read
const markAsRead = asyncHandler(async (req, res) => {
  const result = await MessageService.markAsRead(req.params.conversationId, req.user.id);
  return res.status(200).json(new ApiResponse(200, result, "Messages marked as read."));
});

module.exports = {
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
  markAsRead,
};
