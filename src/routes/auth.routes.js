import express from "express";
import { register, login, getMe } from "../controllers/authController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// ============ PUBLIC ROUTES ============

/**
 * @route   POST /api/auth/login
 * @desc    User login
 * @access  Public
 */
router.post("/login", login);

// ============ PROTECTED ROUTES ============

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (admin only)
 * @access  Private/Admin
 */
router.post("/register", protect, authorize("admin"), register);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private
 */
router.get("/me", protect, getMe);

export default router;
