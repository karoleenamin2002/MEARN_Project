import Joi from "joi";
import xss from "xss";

export const invoiceDocumentBodyValidation = Joi.object({
  invoiceId: Joi.string()
    .trim()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "invoiceId should be a valid ObjectId",
      "any.required": "invoiceId is required",
    }),

  ocrText: Joi.string()
    .trim()
    .allow("")
    .custom((value, helpers) => {
      const sanitized = xss(value);
      if (value !== sanitized) {
        return helpers.error("string.xss");
      }
      return value;
    })
    .default("")
    .messages({
      "string.xss": "ocrText contains potentially unsafe HTML",
    }),

  uploadedAt: Joi.date().default(Date.now),
}).prefs({
  stripUnknown: true,
});

export const invoiceDocumentFileValidation = Joi.object({
  fileName: Joi.string().trim().required(),

  fileType: Joi.string()
    .trim()
    .valid("pdf", "jpg", "jpeg", "png")
    .required(),

  fileUrl: Joi.string().trim().uri().required(),
  publicId: Joi.string().trim().required(),
}).prefs({
  stripUnknown: true,
});