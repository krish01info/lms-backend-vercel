const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const AttendanceService = require("./attendance.service");

// GET /api/v1/attendance/my (student)
const getMyAttendance = asyncHandler(async (req, res) => {
  const result = await AttendanceService.getMyAttendance(req.user.id);
  return res.status(200).json(new ApiResponse(200, result, "Attendance fetched successfully."));
});

// GET /api/v1/attendance/roster?courseId=&date= (instructor owner/admin)
const getRoster = asyncHandler(async (req, res) => {
  const { courseId, date } = req.query;
  const roster = await AttendanceService.getRoster(courseId, date, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, { roster }, "Roster fetched successfully."));
});

// POST /api/v1/attendance/mark (instructor owner/admin)
const markAttendance = asyncHandler(async (req, res) => {
  const { courseId, date, records } = req.body;
  const result = await AttendanceService.markAttendance(courseId, date, records, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, result, "Attendance saved successfully."));
});

// GET /api/v1/attendance/summary?courseId= (instructor owner/admin)
const getSummary = asyncHandler(async (req, res) => {
  const { courseId } = req.query;
  const result = await AttendanceService.getSummary(courseId, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, result, "Attendance summary fetched successfully."));
});

// GET /api/v1/attendance/auto-roster?courseId=&date= (instructor owner/admin)
// Auto-computed attendance based on lesson completion.
const getAutoRoster = asyncHandler(async (req, res) => {
  const { courseId, date } = req.query;
  const result = await AttendanceService.getAutoRoster(courseId, date, req.user.id, req.user.role);
  return res.status(200).json(new ApiResponse(200, result, "Auto roster fetched successfully."));
});

module.exports = { getMyAttendance, getRoster, markAttendance, getSummary, getAutoRoster };
