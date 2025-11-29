/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details = null) {
    return new ApiError(400, message, details);
  }

  static notFound(message = 'Resource not found', details = null) {
    return new ApiError(404, message, details);
  }

  static internal(message = 'Internal server error', details = null) {
    return new ApiError(500, message, details);
  }

  static validation(errors) {
    return new ApiError(400, 'Validation failed', errors);
  }
}

/**
 * Not found handler - for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(`Route not found: ${req.method} ${req.path}`);
  next(error);
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    statusCode: err.statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: true,
      message: err.message,
      details: err.details,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Handle Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: true,
      message: 'File too large. Maximum file size is 500MB.',
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: true,
      message: err.message || 'File upload error',
    });
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: true,
      message: 'Invalid JSON in request body',
    });
  }

  // Handle validation errors from express-validator or similar
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: true,
      message: 'Validation error',
      details: err.errors || err.message,
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: true,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      originalMessage: err.message,
    }),
  });
};

export { ApiError, errorHandler, notFoundHandler };
export default errorHandler;

