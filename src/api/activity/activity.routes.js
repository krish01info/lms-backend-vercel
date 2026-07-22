const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const { protect } = require("../../middleware/auth.middleware")
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/v1/activity/my
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const activity = await prisma.activityLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    res.status(200).json(new ApiResponse(200, { activity }, "Activity fetched"))
  })
)

module.exports = router