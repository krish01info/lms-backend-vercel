const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_STATUS = require("../../constants/httpStatus");
const AdminService = require("./admin.service");

// ── Users ───────────────────────────────────────────────────────────────────

// GET /api/v1/admin/users?search=&role=&status=&page=&limit=
const getUsers = asyncHandler(async (req, res) => {
  const { search, role, status, page = 1, limit = 20 } = req.query;
  const result = await AdminService.getUsers({ search, role, status, page, limit });
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, "Users fetched successfully"));
});

// GET /api/v1/admin/users/:userId
const getUserById = asyncHandler(async (req, res) => {
  const user = await AdminService.getUserById(req.params.userId);
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, { user }, "User fetched successfully"));
});

// PATCH /api/v1/admin/users/:userId — edit name / email / role
const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;
  const user = await AdminService.updateUser(req.params.userId, { name, email, role }, req.user.id);
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, { user }, "User updated successfully"));
});

// PATCH /api/v1/admin/users/:userId/status — { isActive: true|false }
const setUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, "isActive (boolean) is required."));
  }
  const user = await AdminService.setUserStatus(req.params.userId, isActive, req.user.id);
  const msg = isActive ? "User activated" : "User deactivated";
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, { user }, msg));
});

// DELETE /api/v1/admin/users/:userId — soft delete
const deleteUser = asyncHandler(async (req, res) => {
  const result = await AdminService.deleteUser(req.params.userId, req.user.id);
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, "User deactivated"));
});

// ── Courses ─────────────────────────────────────────────────────────────────

// GET /api/v1/admin/courses?search=&status=&page=&limit=
const getCourses = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const result = await AdminService.getCourses({ search, status, page, limit });
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, "Courses fetched successfully"));
});

// PATCH /api/v1/admin/courses/:courseId/status — { status: "PUBLISHED"|"ARCHIVED"|"DRAFT" }
const setCourseStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, "status is required."));
  }
  const course = await AdminService.setCourseStatus(req.params.courseId, status, req.user.id);
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, { course }, "Course status updated"));
});

// ── Payments ────────────────────────────────────────────────────────────────

// GET /api/v1/admin/payments?status=&page=&limit=
const getPayments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const result = await AdminService.getPayments({ status, page, limit });
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, "Payments fetched successfully"));
});

// GET /api/v1/admin/payments/stats
const getPaymentStats = asyncHandler(async (req, res) => {
  const stats = await AdminService.getPaymentStats();
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, stats, "Payment stats fetched successfully"));
});

// ── Dashboard ───────────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard/stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await AdminService.getDashboardStats();
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, stats, "Dashboard stats fetched successfully"));
});

// ── Reports ─────────────────────────────────────────────────────────────────

// GET /api/v1/admin/reports/:type
const getReport = asyncHandler(async (req, res) => {
  const rows = await AdminService.getReport(req.params.type);
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, { rows }, "Report generated successfully"));
});

// ── Analytics ───────────────────────────────────────────────────────────────

// GET /api/v1/admin/analytics
const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await AdminService.getAnalytics();
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, analytics, "Analytics fetched successfully"));
});

// ── Settings ────────────────────────────────────────────────────────────────

// GET /api/v1/admin/settings
const getSettings = asyncHandler(async (req, res) => {
  const settings = await AdminService.getSettings();
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, settings, "Settings fetched successfully"));
});

// PATCH /api/v1/admin/settings — { key, value }
const updateSetting = asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, "key and value are required."));
  }
  const settings = await AdminService.updateSetting(key, value, req.user.id);
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, settings, "Setting updated successfully"));
});

// ── Audit Logs ──────────────────────────────────────────────────────────────

// GET /api/v1/admin/audit-logs?page=&limit=
const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await AdminService.getAuditLogs({ page, limit });
  return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, "Audit logs fetched successfully"));
});

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  setUserStatus,
  deleteUser,
  getCourses,
  setCourseStatus,
  getPayments,
  getPaymentStats,
  getDashboardStats,
  getReport,
  getAnalytics,
  getSettings,
  updateSetting,
  getAuditLogs,
};