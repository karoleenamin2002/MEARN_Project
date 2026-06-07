import { body, param, query, validationResult } from "express-validator";

// ─── Helper: run validation result 
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((e) => ({
        field  : e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

// ─── Constants 
const INVOICE_TYPES   = ["purchase", "sale", "purchase_return", "sales_return", "expense"];
const PAYMENT_METHODS = ["cash", "card", "wallet", "bank_transfer"];
const SALE_SOURCES    = ["POS", "MANUAL"];
const RETURN_TYPES    = ["purchase_return", "sales_return"];
const MONGO_ID_REGEX  = /^[a-f\d]{24}$/i;

// Reusable: MongoDB ObjectId check
const isMongoId = (value) => MONGO_ID_REGEX.test(value);

//Reusable: nullable ObjectId check 
const isNullableMongoId = (value) => {
  if (value === null || value === "") return true;
  return isMongoId(value);
};

// Reusable: item array rules 
const itemRules = [
  body("items")
    .if((_, { req }) => req.body.invoiceType !== "expense")
    .isArray({ min: 1 })
    .withMessage("items must be a non-empty array"),

  body("items")
    .if((_, { req }) => req.body.invoiceType === "expense")
    .optional()
    .isArray()
    .withMessage("items must be an array"),

  body("items.*.productId")
    .if((_, { req }) => req.body.invoiceType !== "expense")
    .notEmpty()
    .withMessage("Each item must have a productId")
    .custom(isMongoId)
    .withMessage("productId must be a valid MongoDB ObjectId"),

  body("items.*.productName")
    .if((_, { req }) => req.body.invoiceType !== "expense")
    .notEmpty()
    .withMessage("Each item must have a productName")
    .isString()
    .trim(),

  body("items.*.quantity")
    .if((_, { req }) => req.body.invoiceType !== "expense")
    .notEmpty()
    .withMessage("Each item must have a quantity")
    .isInt({ min: 1 })
    .withMessage("quantity must be an integer of at least 1"),

  body("items.*.unitPrice")
    .if((_, { req }) => req.body.invoiceType !== "expense")
    .notEmpty()
    .withMessage("Each item must have a unitPrice")
    .isFloat({ min: 0 })
    .withMessage("unitPrice cannot be negative"),

  // totalPrice is server-computed from quantity * unitPrice — never accepted from client
];

// Validation: POST /invoices 
export const createInvoiceRules = [
  body("invoiceType")
    .notEmpty().withMessage("invoiceType is required")
    .isIn(INVOICE_TYPES)
    .withMessage(`invoiceType must be one of: ${INVOICE_TYPES.join(", ")}`),

  // invoiceNumber is generated server-side — never accepted from client

  body("branchId")
    .notEmpty().withMessage("branchId is required")
    .custom(isMongoId).withMessage("branchId must be a valid MongoDB ObjectId"),

  body("clientId")
    .optional({ nullable: true })
    .custom(isNullableMongoId)
    .withMessage("clientId must be a valid MongoDB ObjectId"),

  body("paymentMethod")
    .notEmpty().withMessage("paymentMethod is required")
    .isIn(PAYMENT_METHODS)
    .withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}`),

  body("saleSource")
    .if(body("invoiceType").equals("sale"))
    .notEmpty().withMessage("saleSource is required for sale invoices")
    .isIn(SALE_SOURCES)
    .withMessage(`saleSource must be one of: ${SALE_SOURCES.join(", ")}`),

  body("saleSource")
    .if(body("invoiceType").not().equals("sale"))
    .optional({ nullable: true }),

  body("relatedInvoiceId")
    .if(body("invoiceType").isIn(RETURN_TYPES))
    .notEmpty().withMessage("relatedInvoiceId is required for return invoices")
    .custom(isMongoId).withMessage("relatedInvoiceId must be a valid MongoDB ObjectId"),

  body("relatedInvoiceId")
    .if(body("invoiceType").not().isIn(RETURN_TYPES))
    .optional({ nullable: true }),

  // baseAmount is server-computed from items — never accepted from client
  // taxAmount, finalAmount, changeAmount, dueAmount are server-computed — never accepted from client

  body("taxPercentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("taxPercentage must be between 0 and 100"),

  body("amountPaid")
    .optional()
    .isFloat({ min: 0 }).withMessage("amountPaid cannot be negative"),

  // Duplicate productId check across items
  body("items")
    .if((_, { req }) => req.body.invoiceType !== "expense")
    .custom((items) => {
      if (!Array.isArray(items)) return true;
      const ids = items.map((i) => String(i.productId));
      const unique = new Set(ids);
      if (unique.size !== ids.length) {
        throw new Error("items contains duplicate productId entries — merge quantities instead");
      }
      return true;
    }),

  ...itemRules,

  body("documentId")
    .optional({ nullable: true })
    .custom(isNullableMongoId)
    .withMessage("documentId must be a valid MongoDB ObjectId"),

  body("cashierId")
    .optional({ nullable: true })
    .custom(isNullableMongoId)
    .withMessage("cashierId must be a valid MongoDB ObjectId"),

  body("notes")
    .optional({ nullable: true })
    .isString().trim()
    .isLength({ max: 500 })
    .withMessage("notes must not exceed 500 characters"),

  validate,
];

//  Validation: GET /invoices 
export const getInvoicesRules = [
  query("invoiceType")
    .optional()
    .isIn(INVOICE_TYPES)
    .withMessage(`invoiceType must be one of: ${INVOICE_TYPES.join(", ")}`),

  query("branchId")
    .optional()
    .custom(isMongoId).withMessage("branchId must be a valid MongoDB ObjectId"),

  query("clientId")
    .optional()
    .custom(isMongoId).withMessage("clientId must be a valid MongoDB ObjectId"),

  query("paymentMethod")
    .optional()
    .isIn(PAYMENT_METHODS)
    .withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}`),

  query("saleSource")
    .optional()
    .isIn(SALE_SOURCES)
    .withMessage(`saleSource must be one of: ${SALE_SOURCES.join(", ")}`),

  query("from")
    .optional()
    .isISO8601().withMessage("from must be a valid ISO 8601 date"),

  query("to")
    .optional()
    .isISO8601().withMessage("to must be a valid ISO 8601 date"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),

  validate,
];


// cancelInvoice
export const cancelInvoiceRules = [
  param("id")
    .custom(isMongoId)
    .withMessage("Invoice ID must be a valid MongoDB ObjectId"),

body("reason")
  .notEmpty()
  .withMessage("Cancellation reason is required")
  .isString()
  .trim()
  .isLength({ min: 3, max: 500 })
  .withMessage(
    "Cancellation reason must be between 3 and 500 characters"
  ),

  validate,
];

// ─── Validation: GET /invoices/:id ─────────────────────────────────────────
export const getInvoiceByIdRules = [
  param("id")
    .custom(isMongoId).withMessage("Invoice ID must be a valid MongoDB ObjectId"),

  validate,
];
