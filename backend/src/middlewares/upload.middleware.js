const multer = require('multer');

const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new ApiError(422, 'Unsupported file type', [
          {
            field: 'file',
            message: 'Only PNG, JPG, JPEG, WEBP and SVG images are allowed',
          },
        ]),
      );
      return;
    }

    callback(null, true);
  },
});

function singleImageUpload(fieldName = 'file') {
  return function imageUploadMiddleware(req, res, next) {
    upload.single(fieldName)(req, res, next);
  };
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  singleImageUpload,
};
