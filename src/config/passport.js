const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const config = require("./index");
const { prisma } = require("./database");

passport.use(
  new GoogleStrategy(
    {
      clientID: config.google.clientId || "dummy_id",
      clientSecret: config.google.clientSecret || "dummy_secret",
      callbackURL: config.google.callbackUrl || "http://localhost:5000/api/v1/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email found in Google profile"));
        }

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName || "Google User",
              avatar: profile.photos?.[0]?.value || null,
              googleId: profile.id,
              role: "STUDENT", // default role
              isVerified: true,
            },
          });
        } else if (!user.googleId) {
          // Link Google account if email matches existing account
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: profile.id, isVerified: true },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
