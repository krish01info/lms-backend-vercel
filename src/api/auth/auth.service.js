const bcrypt = require("bcryptjs");
const { prisma } = require("../../config/database");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../../utils/jwtUtils");
const ApiError = require("../../utils/ApiError");

// ─── Role mapping: frontend sends lowercase, DB stores uppercase ──────────────
const normalizeRole = (role) => {
  const map = { 
    student: "STUDENT", 
    teacher: "INSTRUCTOR", 
    instructor: "INSTRUCTOR", 
    admin: "ADMIN" 
  };
  return map[role?.toLowerCase()] || "STUDENT";
};

// ─── Safe user object (no password) ──────────────────────────────────────────
const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role.toLowerCase(), // send lowercase to frontend
  avatar: user.avatar || null,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
});

// ─── Register ─────────────────────────────────────────────────────────────────
const register = async ({ name, email, password, role }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "Email already in use. Please log in instead.");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const dbRole = normalizeRole(role);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: dbRole },
  });

  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });

  return { user: safeUser(user), accessToken, refreshToken };
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.password) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Your account has been deactivated. Contact support.");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });

  return { user: safeUser(user), accessToken, refreshToken };
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refreshTokens = async (token) => {
  const decoded = verifyRefreshToken(token);

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.isActive) {
    throw new ApiError(401, "User not found or deactivated.");
  }

  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const newRefreshToken = signRefreshToken({ id: user.id });

  return { accessToken, refreshToken: newRefreshToken };
};

// ─── Get current user ─────────────────────────────────────────────────────────
const getMe = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found.");
  return safeUser(user);
};

module.exports = { register, login, refreshTokens, getMe };
