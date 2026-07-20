const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const ApiError = require("../../utils/ApiError")
const { protect, requireRole } = require("../../middleware/auth.middleware")
const ROLES = require("../../constants/roles")
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/v1/payments/my
// Returns all payments made by the logged-in student.
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: { id: true, title: true, thumbnail: true }
        }
      }
    })

    return res.status(200).json(
      new ApiResponse(200, { payments }, 'Payments fetched successfully.')
    )
  })
)

// GET /api/v1/payments/:id
router.get('/:id',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { id } = req.params

    const payment = await prisma.payment.findFirst({
      where: { id, userId },
      include: {
        course: {
          select: { id: true, title: true, thumbnail: true }
        }
      }
    })

    if (!payment) throw new ApiError(404, 'Payment not found.')

    return res.status(200).json(
      new ApiResponse(200, { payment }, 'Payment fetched successfully.')
    )
  })
)

// POST /api/v1/payments
// Creates a payment record — used for testing, or manual/offline payment logging.
// A real payment gateway integration (Razorpay/Stripe webhook) would call this
// automatically later; for now it's manually triggerable by any authenticated user.
router.post('/',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { courseId, amount, status, gateway, gatewayId } = req.body

    if (!courseId || amount === undefined) {
      throw new ApiError(400, 'courseId and amount are required.')
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        courseId,
        amount,
        status: status || 'PENDING',
        gateway,
        gatewayId,
      }
    })

    return res.status(201).json(
      new ApiResponse(201, { payment }, 'Payment created successfully.')
    )
  })
)

module.exports = router