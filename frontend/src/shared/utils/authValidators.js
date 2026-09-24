//Shared client-side validation helpers for the auth screens. Mirrors backend authValidators.js

// Deliberately permissive — the server (and the confirmation email) is the
// real authority; this only catches obvious typos before a request is sent
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt input limit, matches the backend

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || "").trim());
}

// Returns an error string, or "" when the password is acceptable
export function validatePassword(value) {
  const password = String(value || "");
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  return "";
}

// Validates an optional numeric profile field against the same bounds the
// server enforces. Returns an error string, or "" when valid/blank
export function validateOptionalNumber(value, { label, min, max, integer = false }) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return `${label} must be a number.`;
  if (integer && !Number.isInteger(parsed)) return `${label} must be a whole number.`;
  if (min !== undefined && parsed < min) return `${label} must be at least ${min}.`;
  if (max !== undefined && parsed > max) return `${label} must be ${max} or less.`;
  return "";
}

// Digits-only OTP check used by the verification screens
export function validateOtp(code, length) {
  const value = String(code || "").trim();
  if (!value) return "Please enter the verification code.";
  if (value.length !== length) return `Please enter the full ${length}-digit code.`;
  if (!/^\d+$/.test(value)) return "The verification code should contain digits only.";
  return "";
}