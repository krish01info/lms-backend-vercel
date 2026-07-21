const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const { protect } = require("../../middleware/auth.middleware")
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/v1/announcements/my
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { courseId: true },
    })
    const courseIds = enrollments.map(e => e.courseId)

    const announcements = await prisma.announcement.findMany({
      where: { OR: [{ courseId: null }, { courseId: { in: courseIds } }] },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    res.status(200).json(new ApiResponse(200, { announcements }, "Announcements fetched"))
  })
)

module.exports = router