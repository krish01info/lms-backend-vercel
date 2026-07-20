const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const AuthService = require("./auth.service");

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json(new ApiResponse(400, null, "name, email, and password are required."));
  }

  const { user, accessToken, refreshToken } = await AuthService.register({ name, email, password, role });

  // Send refresh token as httpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.status(201).json(
    new ApiResponse(201, { user, accessToken }, "Account created successfully.")
  );
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json(new ApiResponse(400, null, "email and password are required."));
  }

  const { user, accessToken, refreshToken } = await AuthService.login({ email, password });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json(
    new ApiResponse(200, { user, accessToken }, "Logged in successfully.")
  );
});

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json(new ApiResponse(401, null, "No refresh token provided."));
  }

  const { accessToken, refreshToken } = await AuthService.refreshTokens(token);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json(
    new ApiResponse(200, { accessToken }, "Token refreshed successfully.")
  );
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "lax" });
  return res.status(200).json(new ApiResponse(200, null, "Logged out successfully."));
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await AuthService.getMe(req.user.id);
  return res.status(200).json(new ApiResponse(200, { user }, "User profile fetched."));
});

const passport = require("passport");
const { signAccessToken, signRefreshToken } = require("../../utils/jwtUtils");

// Initiates Google OAuth authentication
const googleAuth = passport.authenticate("google", { session: false, scope: ["profile", "email"] });

// Handles Google OAuth callback
const googleCallback = (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=Google authentication failed`);
    }

    // Generate tokens
    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    // Set refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.toLowerCase(),
      avatar: user.avatar,
    };

    // Redirect to frontend with tokens and user details
    const redirectUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/login?token=${accessToken}&user=${encodeURIComponent(JSON.stringify(frontendUser))}`;
    return res.redirect(redirectUrl);
  })(req, res, next);
};

module.exports = { register, login, refresh, logout, getMe, googleAuth, googleCallback };

