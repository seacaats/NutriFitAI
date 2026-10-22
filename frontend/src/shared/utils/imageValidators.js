import { Platform } from "react-native";

export const SUPPORTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
]);

export const SUPPORTED_IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

// HEIC/HEIF is convertible on mobile native platforms via ImageManipulator / ImagePicker
export const CONVERTIBLE_MOBILE_MIMES = new Set([
  "image/heic",
  "image/heif",
]);

export const CONVERTIBLE_MOBILE_EXTS = new Set([
  "heic",
  "heif",
]);

export const IMAGE_MAX_BYTES_STANDARD = 2 * 1024 * 1024; // 2 MB

export function getFileExtension(pathOrName = "") {
  if (typeof pathOrName !== "string") return "";
  const clean = pathOrName.split("?")[0].split("#")[0];
  const parts = clean.split("/");
  const filename = parts[parts.length - 1] || "";
  const extParts = filename.split(".");
  if (extParts.length > 1) {
    return extParts.pop().toLowerCase();
  }
  return "";
}

/**
 * Validates an image asset/file for supported format and size limit.
 *
 * @param {object} file - File/Asset object ({ uri, name, fileName, type, mimeType, fileSize, size })
 * @param {object} [options]
 * @param {number} [options.maxBytes] - Optional max file size in bytes
 * @param {boolean} [options.allowConvertibleMobile] - Allow HEIC/HEIF on mobile (default: true except on web)
 * @returns {string|null} Error message or null if valid
 */
export function validateImageFile(file, { maxBytes, allowConvertibleMobile } = {}) {
  if (!file) {
    return "No image selected.";
  }

  const allowConvert = allowConvertibleMobile ?? Platform.OS !== "web";

  // Normalize MIME type
  const rawMime = (file.mimeType || (file.type && file.type.includes("/") ? file.type : "") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  // Normalize filename / uri extension
  const filename = file.fileName || file.name || "";
  let ext = getFileExtension(filename);
  if (!ext && file.uri) {
    ext = getFileExtension(file.uri);
  }

  // Check for explicitly unsupported MIME types (e.g., gif, svg, pdf, etc.)
  const isGenericMime = !rawMime || rawMime === "application/octet-stream" || rawMime === "*/*" || rawMime === "image";
  const hasValidMime = !isGenericMime && (SUPPORTED_IMAGE_MIMES.has(rawMime) || (allowConvert && CONVERTIBLE_MOBILE_MIMES.has(rawMime)));
  const hasInvalidMime = !isGenericMime && !hasValidMime;

  // Check extension
  const hasValidExt = ext && (SUPPORTED_IMAGE_EXTS.has(ext) || (allowConvert && CONVERTIBLE_MOBILE_EXTS.has(ext)));
  const hasInvalidExt = ext && !hasValidExt;

  // If MIME is known and invalid, OR extension is known and invalid, reject
  if (hasInvalidMime || hasInvalidExt) {
    return maxBytes
      ? "Unsupported file format. Please upload a JPEG, PNG, or WebP image under 2 MB."
      : "Unsupported file format. Please upload a JPEG, PNG, or WebP image.";
  }

  // If neither a valid MIME nor a valid extension could be identified, reject
  if (!hasValidMime && !hasValidExt) {
    return maxBytes
      ? "Unsupported file format. Please upload a JPEG, PNG, or WebP image under 2 MB."
      : "Unsupported file format. Please upload a JPEG, PNG, or WebP image.";
  }

  // Check file size if available
  const size = file.fileSize ?? file.size;
  if (maxBytes && typeof size === "number" && size > maxBytes) {
    return "That image is too large. Upload an image under 2 MB.";
  }

  return null;
}
