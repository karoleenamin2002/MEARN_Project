import { body, validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;
const isMongoId = (value) => MONGO_ID_REGEX.test(value);

const ADJUSTMENT_REASONS = [
  "damage",
  "expired",
  "lost",
  "manual_count",
  "correction",
  "other",
];

export const adjustmentRules = [
  body("productId")
    .notEmpty()
    .withMessage("productId is required")
    .custom(isMongoId)
    .withMessage("productId must be a valid MongoDB ObjectId"),

  body("branchId")
    .notEmpty()
    .withMessage("branchId is required")
    .custom(isMongoId)
    .withMessage("branchId must be a valid MongoDB ObjectId"),

  body("actualQuantity")
    .notEmpty()
    .withMessage("actualQuantity is required")
    .isInt({ min: 0 })
    .withMessage("actualQuantity must be an integer greater than or equal to 0"),

  body("reason")
    .notEmpty()
    .withMessage("reason is required")
    .isIn(ADJUSTMENT_REASONS)
    .withMessage(`reason must be one of: ${ADJUSTMENT_REASONS.join(", ")}`),

  body("notes")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must not exceed 500 characters"),

  validate,
];
