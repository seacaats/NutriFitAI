const nodemailer = require('nodemailer');
const env = require('../../config/env');

// SMTP config check
const isConfigured = Boolean(env.mail.host);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    })
  : null;


// Catch mail silently failing on health checks
const status = {
  configured: isConfigured,
  verified: null, // null = not checked yet
  sent: 0,
  failed: 0,
  consecutiveFailures: 0,
  lastError: null,
  lastErrorAt: null,
  lastSuccessAt: null,
};

// SMTP config validation on boot
async function verifyMailer() {
  if (!isConfigured) {
    status.verified = false;
    const message = 'SMTP is not configured (MAIL_HOST unset) — OTP codes will only appear in the server log';
    if (env.nodeEnv === 'production') {
      console.error(`[mailer] ${message}`);
    } else {
      console.warn(`[mailer] ${message}`);
    }
    return false;
  }

  try {
    await transporter.verify();
    status.verified = true;
    console.log(`[mailer] SMTP ready (${env.mail.host}:${env.mail.port})`);
    return true;
  } catch (err) {
    status.verified = false;
    status.lastError = err.message;
    status.lastErrorAt = new Date();
    console.error(`[mailer] SMTP verification FAILED (${env.mail.host}:${env.mail.port}): ${err.message}`);
    console.error('[mailer] Registration will succeed but verification codes will not be delivered.');
    return false;
  }
}

/**
 * @param {string} to
 * @param {string} code
 * @param {'email_verification'|'password_reset'} purpose
 */
async function sendOtpEmail(to, code, purpose) {
  const subject =
    purpose === 'password_reset' ? 'Your NutriFit password reset code' : 'Verify your NutriFit account';

  const html = `
    <p>Your verification code is:</p>
    <h2 style="letter-spacing:4px;">${code}</h2>
    <p>This code expires in ${env.otp.ttlMinutes} minutes. If you didn't request this, you can ignore this email.</p>
  `;

  // Print otp on console
  if (env.nodeEnv !== 'production') {
    console.log(`[mailer:dev] OTP for ${to} (${purpose}): ${code}`);
  }

  if (!isConfigured) {
    if (env.nodeEnv === 'production') {
      throw new Error('SMTP is not configured');
    }
    return { skipped: true };
  }

  try {
    const result = await transporter.sendMail({ from: env.mail.from, to, subject, html });
    status.sent += 1;
    status.consecutiveFailures = 0;
    status.lastSuccessAt = new Date();
    return result;
  } catch (err) {
    status.failed += 1;
    status.consecutiveFailures += 1;
    status.lastError = err.message;
    status.lastErrorAt = new Date();

    // Log for three consecutive failures
    if (status.consecutiveFailures === 3) {
      console.error(
        `[mailer] ALERT: ${status.consecutiveFailures} consecutive send failures. ` +
          `Mail delivery is likely down. Last error: ${err.message}`,
      );
    }

    throw err; // deliverOtpEmail in authController decides what to do about it
  }
}

// Health snapshot
function getMailerStatus() {
  return {
    configured: status.configured,
    verified: status.verified,
    sent: status.sent,
    failed: status.failed,
    consecutiveFailures: status.consecutiveFailures,
    lastErrorAt: status.lastErrorAt,
    lastSuccessAt: status.lastSuccessAt,
    lastError: status.lastError,
  };
}

module.exports = { sendOtpEmail, verifyMailer, getMailerStatus };