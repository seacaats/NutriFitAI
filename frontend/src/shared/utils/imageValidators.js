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

/**
 * Safely invokes ImagePicker.launchImageLibraryAsync and validates the result.
 * Catches any unhandled exceptions thrown by expo-image-picker (e.g., when picking
 * unsupported file types like .zip or .pdf on web).
 *
 * @param {object} ImagePicker - Expo ImagePicker module
 * @param {object} [pickerOptions] - Options passed to launchImageLibraryAsync
 * @param {object} [validatorOptions] - Options passed to validateImageFile ({ maxBytes, allowConvertibleMobile })
 * @returns {Promise<{ asset: object|null, error: string|null, canceled: boolean }>}
 */
export async function pickImageSafe(ImagePicker, pickerOptions = {}, validatorOptions = {}) {
  const defaultErrorMsg = validatorOptions.maxBytes
    ? "Unsupported file format. Please upload a JPEG, PNG, or WebP image under 2 MB."
    : "Unsupported file format. Please upload a JPEG, PNG, or WebP image.";

  try {
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result || result.canceled || !result.assets?.length) {
      return { asset: null, error: null, canceled: true };
    }

    const asset = result.assets[0];
    const validationError = validateImageFile(asset, validatorOptions);
    if (validationError) {
      return { asset: null, error: validationError, canceled: false };
    }

    return { asset, error: null, canceled: false };
  } catch (err) {
    // expo-image-picker throws Error("Unsupported file type: ...") on Web when non-image files are chosen
    return { asset: null, error: defaultErrorMsg, canceled: false };
  }
}
