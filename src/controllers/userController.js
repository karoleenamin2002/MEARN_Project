import User from '../models/User.js';

/**
 * Helper function to send consistent API responses
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {boolean} success - Success flag
 * @param {string} message - Response message
 * @param {*} data - Response data (optional)
 */
const sendResponse = (res, statusCode, success, message, data = null) => {
  const response = { success, message };
  if (data) response.data = data;
  res.status(statusCode).json(response);
};

// ============ USER RETRIEVAL ============

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private/Admin
 */
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash');

    if (!users || users.length === 0) {
      return sendResponse(res, 200, true, 'No users found', []);
    }

    sendResponse(
      res,
      200,
      true,
      `Retrieved ${users.length} user(s) successfully`,
      users
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
export const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendResponse(res, 400, false, 'Invalid user ID format');
    }

    const user = await User.findById(id).select('-passwordHash');

    if (!user) {
      return sendResponse(res, 404, false, 'User not found');
    }

    sendResponse(res, 200, true, 'User fetched successfully', user);
  } catch (error) {
    next(error);
  }
};

// ============ USER MODIFICATION ============

/**
 * @desc    Update user by ID
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendResponse(res, 400, false, 'Invalid user ID format');
    }

    // Validate request body
    if (!name && !email && !role) {
      return sendResponse(
        res,
        400,
        false,
        'At least one field (name, email, or role) is required to update'
      );
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (role) updateData.role = role;

    // Update user with validation enabled
    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select('-passwordHash');

    if (!user) {
      return sendResponse(res, 404, false, 'User not found');
    }

    sendResponse(res, 200, true, 'User updated successfully', user);
  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      return sendResponse(res, 400, false, `Validation error: ${messages}`);
    }

    // Handle duplicate email error
    if (error.code === 11000) {
      return sendResponse(
        res,
        400,
        false,
        'Email already in use by another user'
      );
    }

    next(error);
  }
};

/**
 * @desc    Delete user by ID
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendResponse(res, 400, false, 'Invalid user ID format');
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return sendResponse(res, 404, false, 'User not found');
    }

    sendResponse(res, 200, true, 'User deleted successfully', {
      deletedUser: user.name,
      id: user._id,
    });
  } catch (error) {
    next(error);
  }
};
