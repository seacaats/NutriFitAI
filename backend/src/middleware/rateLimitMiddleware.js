const rateLimit = require('express-rate-limit');
const env = require('../../config/env');

// Throttle login brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
  message: { success: false, message: 'Too many login attempts. Please try again after 5 minutes.' },
});

// Throttle account enumeration on registration
const registerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again after 5 minutes.' },
});

// Enforce OTP resend cooldown to avoid spamming
const otpRequestLimiter = rateLimit({
  windowMs: env.otp.resendCooldownSeconds * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
  message: { success: false, message: 'Please wait for another minute before requesting another code.' },
});

// Throttle OTP verification brute-force attempts
const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
  message: { success: false, message: 'Too many attempts. Please try again later after 5 minutes.' },
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

module.exports = {
  loginLimiter,
  registerLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  refreshLimiter,
  aiChatLimiter,
  stepSyncLimiter,
};