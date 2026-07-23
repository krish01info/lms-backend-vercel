const Joi = require("joi");

const createPaymentSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  status: Joi.string().valid("PENDING", "COMPLETED", "FAILED", "REFUNDED").default("PENDING"),
  gateway: Joi.string().trim().optional(),
  gatewayId: Joi.string().trim().optional(),
});

module.exports = { createPaymentSchema };
