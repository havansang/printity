const multer = require('multer');
const mongoose = require('mongoose');
const { ZodError } = require('zod');

const ApiError = require('../utils/ApiError');

function formatZodErrors(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

function errorMiddleware(error, req, res, next) {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors = [];

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = formatZodErrors(error);
  } else if (error instanceof multer.MulterError) {
    statusCode = 422;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the allowed size limit' : error.message;
    errors = [{ field: 'file', message }];
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = Object.values(error.errors).map((issue) => ({
      field: issue.path,
      message: issue.message,
    }));
  } else if (error?.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
    message = 'Duplicate value';
    errors = [{ field: duplicateField, message: `${duplicateField} already exists` }];
  } else if (error?.message === 'Origin not allowed by CORS') {
    statusCode = 403;
    message = error.message;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }

  const payload = {
    success: false,
    message,
  };

  if (errors.length > 0) {
    payload.errors = errors;
  }

  res.status(statusCode).json(payload);
}

module.exports = { errorMiddleware };
