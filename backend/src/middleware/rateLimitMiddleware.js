const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const { logAction } = require('../utils/audit-logs/auditLogger');

// handler for the credential limiters. Records the FIRST blocked request per
// key per window (used === limit + 1), then answers exactly as the default
// handler would. The email, when there is one, is stored hashed
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

// Second sign-in step. By IP only, since the challenge token isn't trusted
// before it's verified. The per-account lockout (MFA_MAX_FAILED_ATTEMPTS) is
// the real brake: a 6-digit code gets 5 wrong guesses, then 15 minutes off
const mfaLoginLimiter = rateLimit({
  handler: auditedHandler('two-factor sign-in'),
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 5 minutes.' },
});

// Resending the emailed sign-in code: same cooldown as the other OTP resends
const mfaResendLimiter = rateLimit({
  windowMs: env.otp.resendCooldownSeconds * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Please wait a minute before requesting another code.' },
});

// Two-factor setup and changes from Settings, per signed-in user. Each one
// takes a password and/or code guess
const mfaManageLimiter = rateLimit({
  handler: auditedHandler('two-factor settings'),
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, message: 'Too many attempts. Please try again in 5 minutes.' },
});

// Throttle /auth/refresh by enforcing limits by IP
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many session refresh attempts. Please try again shortly.' },
});

// Limit AI chat requests per user to stop exhausting any shared quota
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

// Voice clips per user, they spend a shared free-tier allowance too
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

/**
 * Step sync fires on every app foreground, so this is a runaway guard rather
 * than a usage policy: normal use is a handful of calls an hour, and anything
 * near the limit is a client stuck retrying.
 */
const stepSyncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many sync requests. Please wait a moment.' },
});

// Food scans, per user. Each one is a model inference plus a stored image,
// so this caps a stuck client or a held-down shutter, not normal use
const foodScanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many scans at once. Please wait a moment.' },
});

// Current-password checks from Settings, per signed-in user. Same budget as
// login, since it's the same guess-the-password surface
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
};