const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const { logAction } = require('../utils/audit-logs/auditLogger');

// Logs the first rate-limited request per key per window (used === limit + 1)
function auditedHandler(limiter) {
  return async (req, res, next, options) => {
    if (req.rateLimit && req.rateLimit.used === req.rateLimit.limit + 1) {
      const email = req.body && req.body.email ? String(req.body.email).toLowerCase() : null;
      await logAction(
        req,
        {
          action: 'auth.login.rate_limited',
          targetType: 'user',
          targetId: req.userId ?? null,
          details: { limiter },
          hash: { emailHash: email },
        },
        { userId: req.userId ?? null, role: req.userRole ?? null },
      );
    }
    res.status(options.statusCode).send(options.message);
  };
}

// Throttle login brute-force attacks
const loginLimiter = rateLimit({
  handler: auditedHandler('login'),
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
  message: { success: false, message: 'Too many login attempts. Please try again in 5 minutes.' },
});

// Throttle account enumeration on registration
const registerLimiter = rateLimit({
  handler: auditedHandler('registration'),
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again in 5 minutes.' },
});

// Enforce OTP resend cooldown to avoid spamming
const otpRequestLimiter = rateLimit({
  windowMs: env.otp.resendCooldownSeconds * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
  message: { success: false, message: 'Please wait a minute before requesting another code.' },
});

// Throttle OTP verification brute-force attempts
const otpVerifyLimiter = rateLimit({
  handler: auditedHandler('code verification'),
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
  message: { success: false, message: 'Too many attempts. Please try again in 5 minutes.' },
});

// Second-factor sign-in rate limit by IP (per-account lockout is enforced in mfaController)
const mfaLoginLimiter = rateLimit({
  handler: auditedHandler('two-factor sign-in'),
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 5 minutes.' },
});

// MFA email code resend cooldown
const mfaResendLimiter = rateLimit({
  windowMs: env.otp.resendCooldownSeconds * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Please wait a minute before requesting another code.' },
});

// MFA setup and settings changes per user
const mfaManageLimiter = rateLimit({
  handler: auditedHandler('two-factor settings'),
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, message: 'Too many attempts. Please try again in 5 minutes.' },
});

// Session refresh rate limit by IP
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many session refresh attempts. Please try again shortly.' },
});

// AI chat rate limit per user
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: "You're sending messages faster than the coach can answer. Give it a moment.",
  },
});

// Voice transcription rate limit per user
const voiceTranscribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many voice messages in a row. Give it a moment.',
  },
});

// Step sync rate limit per user
const stepSyncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many sync requests. Please wait a moment.' },
});

// Food scan rate limit per user
const foodScanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many scans at once. Please wait a moment.' },
});

// Avatar upload rate limit per user
const avatarUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many photo changes. Please try again in an hour.' },
});

// Password verification rate limit per user
const passwordCheckLimiter = rateLimit({
  handler: auditedHandler('password check'),
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, message: 'Too many password attempts. Please try again in 5 minutes.' },
});

module.exports = {
  passwordCheckLimiter,
  mfaLoginLimiter,
  mfaManageLimiter,
  mfaResendLimiter,
  loginLimiter,
  registerLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  refreshLimiter,
  aiChatLimiter,
  voiceTranscribeLimiter,
  stepSyncLimiter,
  foodScanLimiter,
  avatarUploadLimiter,
};