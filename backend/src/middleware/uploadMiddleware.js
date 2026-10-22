const multer = require('multer');

// Small images (avatars, workout photos)
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

// Single-file in-memory upload with byte size limit
function memoryUpload(fileSize) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize, files: 1 } });
}

module.exports = { memoryUpload, IMAGE_MAX_BYTES };