import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Helper function to send consistent auth error responses
 */
const sendAuthError = (res, statusCode, message) => {
  res.status(statusCode).json({
    success: false,
    message,
  });
};

/**
 * @middleware protect
 * @desc Authenticate user via JWT token from Authorization header
 * @access Applied to protected routes
 *
 * Expected header format: Authorization: Bearer <token>
 * Attaches decoded user to req.user
 */
export const protect = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    let token = authHeader;

 // Support standard Bearer prefix while keeping raw-token compatibility.
if (authHeader && authHeader.startsWith('Bearer ')) {
  token = authHeader.substring(7);
}

    // Check if token exists
    if (!token) {
      return sendAuthError(
        res,
        401,
        'Unauthorized access - missing authentication token'
      );
    }

    // Verify token signature and expiration
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return sendAuthError(res, 401, 'Authentication token has expired');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return sendAuthError(res, 401, 'Invalid authentication token');
      }
      throw jwtError;
    }

    // Fetch user from database
    req.user = await User.findById(decoded.id).select('-passwordHash');

    // Check if user still exists
    if (!req.user) {
      return sendAuthError(res, 401, 'User no longer exists');
    }

    next();
  } catch (error) {
    return sendAuthError(res, 401, 'Authentication failed');
  }
};

/**
 * @middleware authorize
 * @desc Check if authenticated user has required role(s)
 * @access Applied after protect middleware
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware function
 *
 * Usage: router.get('/admin-only', protect, authorize('admin'), controller)
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure protect middleware has run
    if (!req.user) {
      return sendAuthError(res, 401, 'User information missing - authentication required');
    }

    // Check if user role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return sendAuthError(
        res,
        403,
        `User role '${req.user.role}' does not have permission to access this resource`
      );
    }

    next();
  };
};
