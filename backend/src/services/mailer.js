const crypto = require('crypto');
const env = require('../../config/env');

const PROVIDER = env.mail.provider;
const LABEL = PROVIDER === 'brevo' ? 'Brevo' : 'SMTP';

// Provider config check
const isConfigured = PROVIDER === 'brevo' ? Boolean(env.mail.brevoApiKey) : Boolean(env.mail.host);

// Required lazily, so Brevo-only deploys never load nodemailer
const transporter = PROVIDER === 'smtp' && isConfigured
  ? require('nodemailer').createTransport({
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

// Provider config validation on boot
async function verifyMailer() {
  if (!isConfigured) {
    status.verified = false;
    const missing = PROVIDER === 'brevo' ? 'BREVO_API_KEY' : 'SMTP_HOST';
    const message = `${LABEL} is not configured (${missing} unset)`;
    if (env.nodeEnv === 'production') {
      console.error(`[mailer] ${message}`);
    } else {
      console.warn(`[mailer] ${message}`);
    }
    return false;
  } 

  // Brevo has no verify call, the key is first checked on the first send
  if (PROVIDER === 'brevo') {
    status.verified = true;
    console.log('[mailer] Brevo ready');
    return true;
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

// Brand colors, matching shared/theme/nutrifitai.js on the frontend
const BRAND = {
  header: '#24680d',
  accent: '#4caf1f',
  tint: '#f0faeb',
  text: '#1e2939',
  muted: '#6a7282',
  border: '#d1d5dc',
};
// The app uses the platform's system font, so emails do the same
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Escapes user-influenced text (the email address) before it goes into HTML
function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// Shared layout for every email. Tables and inline styles only, since most
// mail clients strip <style> blocks and ignore flexbox
function renderEmail({ title, intro, code, actions = [], note }) {
  const codeBlock = code
    ? `<tr><td align="center" style="padding:8px 32px 24px;">
         <div style="display:inline-block;background:${BRAND.tint};border:1px solid ${BRAND.accent};border-radius:12px;padding:16px 28px;font-size:32px;font-weight:800;letter-spacing:10px;color:${BRAND.header};">${esc(code)}</div>
       </td></tr>`
    : '';

  const buttons = actions.length
    ? `<tr><td align="center" style="padding:4px 32px 24px;">${actions.map((a, i) => `
         <a href="${esc(a.href)}" style="display:inline-block;margin:4px;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;${
           i === 0
             ? `background:${BRAND.accent};color:#ffffff;`
             : `background:#ffffff;color:${BRAND.header};border:1px solid ${BRAND.accent};`
         }">${esc(a.label)}</a>`).join('')}
       </td></tr>`
    : '';

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f7f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f4;padding:24px 12px;font-family:${FONT};">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
      <tr><td style="background:${BRAND.header};padding:20px 32px;">
        <span style="font-size:20px;font-weight:800;color:#ffffff;">NutriFitAI</span>
      </td></tr>
      <tr><td style="padding:28px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND.text};">${esc(title)}</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:22px;color:${BRAND.text};">${intro}</p>
      </td></tr>
      ${codeBlock}
      ${buttons}
      <tr><td style="padding:0 32px 28px;">
        <p style="margin:0;font-size:13px;line-height:20px;color:${BRAND.muted};">${note}</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:${BRAND.muted};">NutriFitAI &middot; Your Food. Your Fitness. Your Future.</p>
  </td></tr>
</table>
</body></html>`;
}

// Same recipient + same dedupe key (purpose + code) inside this window is sent once,
// so a repeated call can't land a duplicate. In memory: resets on restart
const DEDUPE_MS = 30 * 1000;
const recentSends = new Map();

// Sends one email, tracking status the same way for every kind
async function deliver(to, subject, html, devLog, dedupeKey) {
  if (dedupeKey) {
    const key = `${to}:${dedupeKey}`;
    if (recentSends.has(key)) return { skipped: true };
    recentSends.set(key, true);
    setTimeout(() => recentSends.delete(key), DEDUPE_MS).unref();
  }

  // Print to console outside production, so flows work without SMTP
  if (env.nodeEnv !== 'production') {
    console.log(`[mailer:dev] ${devLog}`);
  }

  if (!isConfigured) {
    if (env.nodeEnv === 'production') {
      throw new Error(`${LABEL} is not configured`);
    }
    return { skipped: true };
  }

  try {
    const result = await send({ from: env.mail.from, to, subject, html });
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

    throw err; // callers in authController decide what to do about it
  }
}

// One send, whichever provider is selected
async function send({ from, to, subject, html }) {
  // Unique per message, so clients don't stack same-subject emails into one thread
  const headers = { 'X-Entity-Ref-ID': crypto.randomUUID() };
  if (PROVIDER === 'brevo') {
    // MAIL_FROM is "Name <address>", Brevo wants the two apart
    const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    const sender = match ? { name: match[1] || undefined, email: match[2] } : { email: from.trim() };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.mail.brevoApiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, headers }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || `Brevo replied ${response.status}`);
    return result;
  }
  return transporter.sendMail({ from, to, subject, html, headers });
}

// Wording per purpose. login_mfa is the second sign-in step, mfa_change turns
// email two-factor on or off from Settings
const OTP_COPY = {
  email_verification: {
    subject: 'Verify your NutriFitAI account',
    title: 'Verify your email',
    intro: 'Welcome to NutriFitAI! Use this code to finish creating your account.',
  },
  password_reset: {
    subject: 'Your NutriFitAI password reset code',
    title: 'Reset your password',
    intro: 'Use this code to reset your NutriFitAI password.',
  },
  login_mfa: {
    subject: 'Your NutriFitAI sign-in code',
    title: 'Confirm it\'s you',
    intro: 'Use this code to finish signing in to NutriFitAI.',
  },
  mfa_change: {
    subject: 'Your NutriFitAI security code',
    title: 'Confirm this change',
    intro: 'Use this code to change two-factor sign-in on your NutriFitAI account.',
  },
};

/**
 * @param {string} to
 * @param {string} code
 * @param {'email_verification'|'password_reset'|'login_mfa'|'mfa_change'} purpose
 */
async function sendOtpEmail(to, code, purpose) {
  const copy = OTP_COPY[purpose] || OTP_COPY.email_verification;

  const html = renderEmail({
    title: copy.title,
    intro: copy.intro,
    code,
    note: `This code expires in ${env.otp.ttlMinutes} minutes. If you didn't request it, you can safely ignore this email.`,
  });

  // Subject stays code-free so the code isn't visible in inbox previews or notifications
  return deliver(to, copy.subject, html, `OTP for ${to} (${purpose}): ${code}`, `${purpose}:${code}`);
}

// Sent when someone registers with an email that already has a verified account
async function sendRegistrationNoticeEmail(to) {
  const html = renderEmail({
    title: 'Someone tried to register with your email',
    intro: `A new NutriFitAI account was requested for <strong>${esc(to)}</strong>, which already has an account. No changes were made.`,
    actions: [
      { label: 'Log in', href: `${env.appUrl}/login` },
      { label: 'Reset password', href: `${env.appUrl}/forgot-password?email=${encodeURIComponent(to)}` },
    ],
    note: "If this was you, log in or reset your password. If it wasn't, you can ignore this email; your account is safe.",
  });

  return deliver(to, 'Someone tried to register with your email', html, `Registration notice for ${to}`);
}

// Account notices (password changed, suspended, deleted...), sent by
// services/notifications/notify.js. Plain text in, escaped here, so no caller builds HTML
async function sendNoticeEmail(to, { subject, title, intro, note }) {
  const html = renderEmail({
    title,
    intro: esc(intro),
    actions: [{ label: 'Open NutriFitAI', href: `${env.appUrl}/login` }],
    note: esc(note || "If this wasn't you, reset your password and contact support."),
  });
  return deliver(to, subject, html, `Notice for ${to}: ${subject}`);
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

module.exports = { sendOtpEmail, sendRegistrationNoticeEmail, sendNoticeEmail, verifyMailer, getMailerStatus };