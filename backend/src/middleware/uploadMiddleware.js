const multer = require('multer');

// Small images (avatars, workout photos)
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

// Upload to memory first as a buffer, one file per request, size-capped
// before it is buffered
function memoryUpload(fileSize) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize, files: 1 } });
}

module.exports = { memoryUpload, IMAGE_MAX_BYTES };