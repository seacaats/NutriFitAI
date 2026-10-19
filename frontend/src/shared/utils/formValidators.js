// Shared client-side validation helpers for the form screens. Mirrors backend authValidators.js

// Deliberately permissive — the server (and the confirmation email) is the
// real authority; this only catches obvious typos before a request is sent
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Letters (any script, incl. accents like "ñ"), plus spaces, hyphens,
// apostrophes and periods. Must start with a letter. Mirrors NAME_RE in the backend's validators/shared/fieldSchemas.js
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u;

const PASSWORD_MIN_LENGTH = 8;
// Mirrors the backend. Not advertised in the UI -- the hint only nudges users
// toward 16, but anything up to this is accepted
const PASSWORD_MAX_LENGTH = 64;

// Longest first/last name and email. Mirror NAME_MAX and EMAIL_MAX in the backend's validators/shared/fieldSchemas.js
export const NAME_MAX = 75;
export const EMAIL_MAX = 254;

// Age bounds, mirrors registerSchema / updateProfileSchema
// Mirrors AGE_MIN and AGE_MAX in the backend's validators/shared/fieldSchemas.js
export const AGE_MIN = 13;
export const AGE_MAX = 122;

export const PASSWORD_HINT =
  "Tip: mix upper & lowercase letters, numbers and symbols, or just make it longer (up to 16 characters).";

export function isValidEmail(value) {
  const email = String(value || "").trim();
  return email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

// Returns an error string, or "" when the name is acceptable
export function validateName(value, { label, required = false, max = NAME_MAX }) {
  const name = String(value || "").trim();
  if (!name) return required ? `Please enter your ${label.toLowerCase()}.` : "";
  if (name.length > max) return `${label} is too long.`;
  if (!NAME_RE.test(name)) {
    return `${label} can only contain letters, spaces, hyphens (-), apostrophes (') and periods (.).`;
  }
  return "";
}

// Returns an error string, or "" when the password is acceptable
export function validatePassword(value) {
  const password = String(value || "");
  if (!password) return "Please enter your password.";
  if (!password.trim()) return "Password can't be only spaces.";
  if (/\s/.test(password)) return "Password can't contain spaces.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) return "Password is too long.";
  return "";
}

// Validates a numeric profile field against the same bounds the server
// enforces. Returns an error string, or "" when valid (or blank and optional)
export function validateNumber(value, { label, min, max, integer = false, required = false }) {
  const raw = String(value ?? "").trim();
  if (!raw) return required ? `Please enter your ${label.toLowerCase()}.` : "";

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