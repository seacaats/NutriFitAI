const multer = require('multer');
const { ApiError } = require('../utils/httpResponse');

// Small images (avatars, workout photos)
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
]);

const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function imageFileFilter(req, file, cb) {
  const mimetype = (file.mimetype || '').split(';')[0].trim().toLowerCase();
  const ext = (file.originalname || '').split('.').pop().toLowerCase();

  // Accept if valid mime or valid extension (magic bytes and size checked in controller)
  if (ALLOWED_IMAGE_TYPES.has(mimetype) || (ext && ALLOWED_IMAGE_EXTS.has(ext))) {
    return cb(null, true);
  }

  return cb(
    ApiError.badRequest(
      'Unsupported file format. Please upload a JPEG, PNG, or WebP image.',
      { code: 'INVALID_IMAGE' },
    ),
  );
}

function imageUpload(fileSize = IMAGE_MAX_BYTES) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize, files: 1 },
    fileFilter: imageFileFilter,
  });
}

// Single-file in-memory upload with byte size limit
function memoryUpload(fileSize) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize, files: 1 } });
}

module.exports = { memoryUpload, imageUpload, IMAGE_MAX_BYTES };
