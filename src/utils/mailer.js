const nodemailer = require("nodemailer");
const config = require("../config");

// Lazily created — dev environments without SMTP configured shouldn't crash on boot.
let transporter = null;
const getTransporter = () => {
  if (!config.email.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: Number(config.email.port),
      secure: Number(config.email.port) === 465,
      auth: config.email.user ? { user: config.email.user, pass: config.email.password } : undefined,
    });
  }
  return transporter;
};

/** Send an email. No-ops with a console log if SMTP isn't configured (local dev). */
const sendMail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    console.log(`✉️  [mailer disabled — no SMTP_HOST set] Would send "${subject}" to ${to}`);
    return { skipped: true };
  }
  return t.sendMail({ from: config.email.from, to, subject, html, text });
};

module.exports = { sendMail };
