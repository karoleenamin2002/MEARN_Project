/**
 * Global Error Handler Middleware
 * @middleware errorHandler
 * @desc Centralized error handling for all routes
 * @access Applied globally at the end of middleware stack
 *
 * Handles:
 * - MongoDB validation errors
 * - MongoDB duplicate key errors
 * - MongoDB cast errors (invalid ObjectId)
 * - JWT errors
 * - Custom application errors
 * - Generic server errors
 */

/**
 * Format error response based on error type
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {

  /**
   * Handling the error (Cannot set headers once the response sent to the client)
   * this happens cause we try to send response in the middleware and send response again 
   * in the next one or in the controller (the final middleware)
   */
  if (res.headersSent) {
    return next(err);
  }

  // Copy error object to avoid mutation
  let error = { ...err };
  error.message = err.message;

  // ============ MONGODB ERRORS ============

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.message = `${field} already exists in the database. Please use a different value.`;
    error.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    error.message = `Validation Error: ${messages}`;
    error.statusCode = 400;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error.message = `Invalid ${err.kind} format: ${err.value}`;
    error.statusCode = 400;
  }

  // ============ JWT ERRORS ============

  // JSON Web Token errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token. Please login again.';
    error.statusCode = 401;
  }

  // Token expired error
  if (err.name === 'TokenExpiredError') {
    error.message = 'Token has expired. Please login again.';
    error.statusCode = 401;
  }

  // ============ DEFAULT ERROR RESPONSE ============

  const statusCode = error.statusCode || err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Prepare response object
  const response = {
    success: false,
    message: error.message || 'An internal server error occurred',
    ...(isDevelopment && {
      // Include stack trace only in development
      stack: err.stack,
      originalError: err.message,
      errorName: err.name,
    }),
  };

  // Log error to console
  console.error(`
╔════════════════════════════════════════╗
║         ❌ Error Caught               ║
╠════════════════════════════════════════╣
║ Name:       ${err.name.padEnd(28)} ║
║ Status:     ${statusCode.toString().padEnd(28)} ║
║ Message:    ${error.message.substring(0, 28).padEnd(28)} ║
║ Path:       ${req.path?.substring(0, 28).padEnd(28) || 'N/A'.padEnd(28)} ║
║ Method:     ${req.method?.padEnd(28) || 'N/A'.padEnd(28)} ║
╚════════════════════════════════════════╝
  `);

  // Send error response
  res.status(statusCode).json(response);
};

// ============ EXPORT ============

export default errorHandler;
