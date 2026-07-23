const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const paymentsService = require("./payments.service");

const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await paymentsService.getMyPayments(req.user.id);
  res.status(200).json(new ApiResponse(200, { payments }, "Payments fetched successfully."));
});

const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await paymentsService.getPaymentById(req.params.id, req.user.id);
  res.status(200).json(new ApiResponse(200, { payment }, "Payment fetched successfully."));
});

const createPayment = asyncHandler(async (req, res) => {
  const payment = await paymentsService.createPayment({ userId: req.user.id, ...req.body });
  res.status(201).json(new ApiResponse(201, { payment }, "Payment created successfully."));
});

module.exports = { getMyPayments, getPaymentById, createPayment };
