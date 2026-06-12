import Joi from "joi";
import xss from "xss";

export const invoiceDocumentValidation = Joi.object({
  invoiceId: Joi.string()
    .trim()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.base.pattern": "invoiceId should be a valid ObjectId",
    }),
  fileName: Joi.string()
    .trim()
    .pattern(/^[^\s\\/:\*\?"<>\|]+\.[a-zA-Z0-9]+$/)
    .required(),
  fileType: Joi.string().trim().valid("pdf", "jpg", "jpeg", "png").required(),
  fileUrl: Joi.string().trim().uri().required(),
  ocrText: Joi.string()
    .trim()
    .custom((value, helpers) => {
      const sanitized = xss(value);
      if (value !== sanitized) {
        return helpers.error("string.xss");
      }
    })
    .default("")
    .messages({
      "string.xss": "Input contains potentially unsafe HTML",
    }),
  uploadedAt: Joi.date().default(Date.now),
});

export const invoiceDocumentUpdateValidation = invoiceDocumentValidation
  .fork(
    ["invoiceId", "fileName", "fileType", "fileUrl", "ocrText", "uploadedAt"],

    (schema) => schema.optional(),
  )
  .prefs({
    stripUnknown: true,
  });
