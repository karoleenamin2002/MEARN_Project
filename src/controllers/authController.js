import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ============ HELPER FUNCTIONS ============

/**
 * Generate JWT token for user
 * @param {ObjectId} id - User ID
 * @returns {string} JWT token
 */
const signToken = (id) => {
  try {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  } catch (error) {
    throw new Error('Token generation failed');
  }
};

/**
 * Helper function to send consistent auth responses
 */
const sendAuthResponse = (res, statusCode, success, message, additionalData = {}) => {
  const response = {
    success,
    message,
    ...additionalData,
  };
  res.status(statusCode).json(response);
};

// ============ AUTHENTICATION CONTROLLERS ============

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Private/Admin
 * @body    {name, email, password, role}
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return sendAuthResponse(
        res,
        400,
        false,
        'Name, email, and password are required'
      );
    }

    // Trim and normalize input
    const normalizedData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: password,
      role: role || 'employee',
    };

    // Create user (User model will validate and hash password)
    const user = await User.create(normalizedData);

    // Generate token
    const token = signToken(user._id);

    // Send success response
    sendAuthResponse(res, 201, true, 'User registered successfully', {
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      return sendAuthResponse(res, 400, false, `Validation error: ${messages}`);
    }

    // Handle duplicate email error
    if (error.code === 11000) {
      return sendAuthResponse(
        res,
        400,
        false,
        'Email already registered. Please use a different email or try logging in.'
      );
    }

    // Pass other errors to error handler
    next(error);
  }
};

/**
 * @desc    User login
 * @route   POST /api/auth/login
 * @access  Public
 * @body    {email, password}
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return sendAuthResponse(
        res,
        400,
        false,
        'Email and password are required'
      );
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Find user and include password field
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+passwordHash'
    );

    // Check if user exists
    if (!user) {
      return sendAuthResponse(
        res,
        401,
        false,
        'Invalid email or password'
      );
    }

    // Compare passwords
    let isPasswordCorrect;
    try {
      isPasswordCorrect = await user.comparePassword(password);
    } catch (err) {
      return sendAuthResponse(res, 401, false, 'Authentication failed');
    }

    if (!isPasswordCorrect) {
      return sendAuthResponse(
        res,
        401,
        false,
        'Invalid email or password'
      );
    }

    // Generate token
    const token = signToken(user._id);

    // Send success response
    sendAuthResponse(res, 200, true, 'Login successful', {
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    // User is already attached to req by protect middleware
    if (!req.user) {
      return sendAuthResponse(res, 401, false, 'User not found');
    }

    sendAuthResponse(res, 200, true, 'User profile retrieved', {
      data: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
