const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const { protect } = require("../../middleware/auth.middleware")
const { prisma } = require("../../config/database")

// GET /api/v1/fees/my
// Derived fee data — no dedicated Fee table exists yet, so this treats each
// enrolled course's price as a "fee", and checks for a COMPLETED Payment
// record against that course to determine paid/pending status.
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    const [enrollments, payments] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId },
        select: {
          id: true,
          courseId: true,
          createdAt: true,
          course: { select: { title: true, price: true } },
        },
      }),
      prisma.payment.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { courseId: true },
      }),
    ])

    const paidCourseIds = new Set(payments.map((p) => p.courseId))

    const feeItems = enrollments.map((enr) => {
      const isPaid = paidCourseIds.has(enr.courseId)
      const amount = Number(enr.course.price)
      return {
        id: enr.id,
        title: `${enr.course.title} — Course Fee`,
        courseId: enr.courseId,
        amount,
        status: isPaid ? 'PAID' : 'PENDING',
        referenceDate: enr.createdAt,
      }
    })

    const totalFees = feeItems.reduce((sum, f) => sum + f.amount, 0)
    const amountPaid = feeItems
      .filter((f) => f.status === 'PAID')
      .reduce((sum, f) => sum + f.amount, 0)
    const outstanding = totalFees - amountPaid
    const percentagePaid = totalFees > 0 ? Math.round((amountPaid / totalFees) * 100) : 0

    res.status(200).json(
      new ApiResponse(
        200,
        { totalFees, amountPaid, outstanding, percentagePaid, feeItems },
        "Fees fetched successfully."
      )
    )
  })
)

module.exports = router