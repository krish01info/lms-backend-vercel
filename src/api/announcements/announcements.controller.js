const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const AnnouncementService = require("./announcements.service");

// POST /api/v1/announcements
const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, courseId } = req.body;

  const announcement = await AnnouncementService.createAnnouncement({
    title,
    body,
    courseId,
    instructorId: req.user.id,
    role: req.user.role,
  });

  return res.status(201).json(new ApiResponse(201, { announcement }, "Announcement posted successfully."));
});

// GET /api/v1/announcements?courseId=&page=&limit=
const getAnnouncements = asyncHandler(async (req, res) => {
  const { courseId, page, limit } = req.query;

  const result = await AnnouncementService.getAnnouncements({
    courseId,
    page,
    limit,
    userId: req.user.id,
    role: req.user.role,
  });

  return res.status(200).json(new ApiResponse(200, result, "Announcements fetched successfully."));
});

// GET /api/v1/announcements/:id
const getAnnouncementById = asyncHandler(async (req, res) => {
  const announcement = await AnnouncementService.getAnnouncementById(req.params.id);
  return res.status(200).json(new ApiResponse(200, { announcement }, "Announcement fetched successfully."));
});

// PATCH /api/v1/announcements/:id
const updateAnnouncement = asyncHandler(async (req, res) => {
  const { title, body } = req.body;

  const announcement = await AnnouncementService.updateAnnouncement(
    req.params.id,
    { title, body },
    req.user.id,
    req.user.role
  );

  return res.status(200).json(new ApiResponse(200, { announcement }, "Announcement updated successfully."));
});

// DELETE /api/v1/announcements/:id
const deleteAnnouncement = asyncHandler(async (req, res) => {
  await AnnouncementService.deleteAnnouncement(req.params.id, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, null, "Announcement deleted successfully."));
});

module.exports = { createAnnouncement, getAnnouncements, getAnnouncementById, updateAnnouncement, deleteAnnouncement };
