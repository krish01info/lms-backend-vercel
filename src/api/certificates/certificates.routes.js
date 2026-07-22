const express = require("express")
const router = express.Router()
const asyncHandler = require("../../utils/asyncHandler")
const ApiResponse = require("../../utils/ApiResponse")
const ApiError = require("../../utils/ApiError")
const { protect, requireRole } = require("../../middleware/auth.middleware")
const ROLES = require("../../constants/roles")
const { prisma } = require('../../config/database')

// GET /api/v1/certificates/my
// Returns all certificates earned by the logged-in student.
router.get('/my',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    const certificates = await prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      include: {
        course: {
          select: { id: true, title: true, thumbnail: true }
        }
      }
    })

    return res.status(200).json(
      new ApiResponse(200, { certificates }, 'Certificates fetched successfully.')
    )
  })
)

// GET /api/v1/certificates/:id
// Returns a single certificate by id (must belong to the logged-in user).
router.get('/:id',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { id } = req.params

    const certificate = await prisma.certificate.findFirst({
      where: { id, userId },
      include: {
        course: {
          select: { id: true, title: true, thumbnail: true }
        }
      }
    })

    if (!certificate) throw new ApiError(404, 'Certificate not found.')

    return res.status(200).json(
      new ApiResponse(200, { certificate }, 'Certificate fetched successfully.')
    )
  })
)

// POST /api/v1/certificates
// Issues a certificate for a user who completed a course.
// Restricted to INSTRUCTOR/ADMIN — issued manually or by an automated
// "course completed" trigger later.
router.post('/',
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { userId, courseId, fileUrl } = req.body

    if (!userId || !courseId) {
      throw new ApiError(400, 'userId and courseId are required.')
    }

    const certificate = await prisma.certificate.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { fileUrl },
      create: { userId, courseId, fileUrl }
    })

    return res.status(201).json(
      new ApiResponse(201, { certificate }, 'Certificate issued successfully.')
    )
  })
)

module.exports = router