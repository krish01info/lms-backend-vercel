const bcrypt = require("bcryptjs");
const { prisma } = require("../../config/database");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../../utils/jwtUtils");
const ApiError = require("../../utils/ApiError");
const { enqueueEmail } = require("../../queues/email.queue");

// ─── Role mapping: frontend sends lowercase, DB stores uppercase ──────────────
const normalizeRole = (role) => {
  const map = { 
    student: "STUDENT", 
    teacher: "INSTRUCTOR", 
    instructor: "INSTRUCTOR", 
    admin: "ADMIN",
    parent: "PARENT",
  };
  return map[role?.toLowerCase()] || "STUDENT";
};

// ─── Safe user object (no password) ──────────────────────────────────────────
const safeUser = (user) => {
  let role = user.role.toLowerCase();
  if (role === "instructor") {
    role = "teacher";
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    avatar: user.avatar || null,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
};

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

  // Fire-and-forget — never let a slow/broken mail queue block registration.
  enqueueEmail({
    to: user.email,
    subject: "Welcome to LearnFlow!",
    html: `<p>Hi ${user.name},</p><p>Your account has been created. Happy learning!</p>`,
  }).catch(() => {});

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
