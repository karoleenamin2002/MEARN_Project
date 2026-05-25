const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Private (admin only)
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await User.create({ name, email, passwordHash: password, role });
    const token = signToken(user._id);
    res.status(201).json({ success: true, token, data: { _id: user._id, name, email, role } });
  } catch (error) {
    next(error);
  }
};

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({ success: true, token, data: { _id: user._id, name: user.name, email, role: user.role } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};
