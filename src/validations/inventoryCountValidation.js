import { body, param, validationResult } from "express-validator";

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

export const initiateCountRules = [
  body("branchId")
    .notEmpty()
    .withMessage("branchId is required")
    .custom(isMongoId)
    .withMessage("branchId must be a valid MongoDB ObjectId"),

  body("notes")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must not exceed 500 characters"),

  validate,
];

export const performCountRules = [
  param("id")
    .custom(isMongoId)
    .withMessage("Count ID must be a valid MongoDB ObjectId"),

  body("items")
    .notEmpty()
    .withMessage("items array is required")
    .isArray({ min: 1 })
    .withMessage("items must be a non-empty array"),

  body("items.*.product")
    .notEmpty()
    .withMessage("Each item must have a product ID")
    .custom(isMongoId)
    .withMessage("product must be a valid MongoDB ObjectId"),

  body("items.*.countedQuantity")
    .notEmpty()
    .withMessage("Each item must have a countedQuantity")
    .isFloat({ min: 0 })
    .withMessage("countedQuantity cannot be negative"),

  body("notes")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must not exceed 500 characters"),

  validate,
];

export const completeCountRules = [
  param("id")
    .custom(isMongoId)
    .withMessage("Count ID must be a valid MongoDB ObjectId"),

  body("items")
    .optional({ nullable: true })
    .isArray()
    .withMessage("items must be an array"),

  body("items.*.product")
    .if(body("items").exists())
    .notEmpty()
    .withMessage("Each item must have a product ID")
    .custom(isMongoId)
    .withMessage("product must be a valid MongoDB ObjectId"),

  body("items.*.countedQuantity")
    .if(body("items").exists())
    .notEmpty()
    .withMessage("Each item must have a countedQuantity")
    .isFloat({ min: 0 })
    .withMessage("countedQuantity cannot be negative"),

  body("notes")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must not exceed 500 characters"),

  validate,
];

export const cancelCountRules = [
  param("id")
    .custom(isMongoId)
    .withMessage("Count ID must be a valid MongoDB ObjectId"),

  validate,
];
