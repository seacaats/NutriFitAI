const crypto = require('crypto');
const bcrypt = require('bcrypt');
const env = require('../../../config/env');

const OTP_SALT_ROUNDS = 10;

function generateOtp(length = env.otp.length) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

function hashOtp(code) {
  return bcrypt.hash(code, OTP_SALT_ROUNDS);
}

function verifyOtp(code, hash) {
  return bcrypt.compare(code, hash);
}

function otpExpiryDate() {
  return new Date(Date.now() + env.otp.ttlMinutes * 60 * 1000);
}

// ---- Authenticator app (TOTP, RFC 6238) ------------------------------------
// SHA-1, 6 digits, 30 s steps: what every authenticator app supports

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
// One step either side of now, for clock drift. Wider widens the guess window
const TOTP_DRIFT_STEPS = 1;

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// 160 bits, the size RFC 4226 recommends
function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/**
 * The time step `code` is valid for, or null. Compares every step in the
 * window (no early exit) in constant time. The caller must still claim the
 * step (User.claimTotpStep) so the same code can't be used twice
 */
function matchTotpStep(secret, code) {
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code)) return null;
  const now = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  const given = Buffer.from(code);
  let matched = null;
  for (let drift = -TOTP_DRIFT_STEPS; drift <= TOTP_DRIFT_STEPS; drift += 1) {
    const step = now + drift;
    if (crypto.timingSafeEqual(Buffer.from(totpAt(secret, step)), given)) matched = step;
  }
  return matched;
}

// What the QR code and the "open in authenticator app" link carry
function buildOtpauthUri({ secret, email }) {
  const issuer = encodeURIComponent(env.mfa.issuer);
  const label = `${issuer}:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

// ---- Secrets at rest ----------------------------------------------------------
// AES-256-GCM, bound to the user id so a stored secret can't be copied onto
// another account. Format: v1.<iv>.<tag>.<ciphertext>, all base64url

const mfaKey = () => crypto.createHash('sha256').update(env.mfa.encryptionKey).digest();

function encryptMfaSecret(secret, userId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', mfaKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((part) => (Buffer.isBuffer(part) ? part.toString('base64url') : part)).join('.');
}

function decryptMfaSecret(stored, userId) {
  const [version, iv, tag, data] = String(stored).split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable MFA secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', mfaKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

// ---- Recovery codes -------------------------------------------------------------
// 10 characters from an alphabet without look-alikes (~50 bits each), shown
// once as xxxxx-xxxxx. Stored only as a keyed hash: they're random and long,
// so a fast HMAC is enough and lets the single-use check be one atomic update

const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;

function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    let code = '';
    for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) code += RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

// Spaces, dashes and case don't matter when typing one in
const normalizeRecoveryCode = (code) => String(code).toLowerCase().replace(/[^a-z0-9]/g, '');
const isRecoveryCodeShape = (code) => normalizeRecoveryCode(code).length === RECOVERY_CODE_LENGTH;

function hashRecoveryCode(code) {
  return crypto.createHmac('sha256', env.mfa.encryptionKey).update(normalizeRecoveryCode(code)).digest('hex');
}

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
  otpExpiryDate,
  generateTotpSecret,
  matchTotpStep,
  buildOtpauthUri,
  encryptMfaSecret,
  decryptMfaSecret,
  generateRecoveryCodes,
  isRecoveryCodeShape,
  hashRecoveryCode,
};