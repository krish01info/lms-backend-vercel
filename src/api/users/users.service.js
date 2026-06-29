const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      isVerified: true,
      createdAt: true,
      _count: {
        select: {
          enrollments: true,
          courses: true,
        },
      },
    },
  });

  if (!user) throw new ApiError(404, "User not found.");

  return {
    ...user,
    role: user.role.toLowerCase(),
    enrolledCount: user._count.enrollments,
    coursesCount: user._count.courses,
    _count: undefined,
  };
};

const updateProfile = async (userId, { name, avatar }) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { ...(name && { name }), ...(avatar && { avatar }) },
    select: { id: true, name: true, email: true, role: true, avatar: true, isVerified: true },
  });
  return { ...user, role: user.role.toLowerCase() };
};

module.exports = { getProfile, updateProfile };
