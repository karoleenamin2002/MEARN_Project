import { catchError } from "../utils/catchError.js";
import {
  invoiceDocumentBodyValidation,
  invoiceDocumentFileValidation,
} from "../validations/invoiceDocument.validation.js";
import documentModel from "../models/InvoiceDocument.js";
import invoiceModel from "../models/Invoice.js";
import AppError from "../utils/appError.js";

export const createInvoiceDocument = catchError(async (req, res) => {
  const { error, value: inputValues } = invoiceDocumentBodyValidation.validate(
    req.body,
  );

  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((detail) => detail.message),
    });
  }

  const { invoiceId, ocrText, uploadedAt } = inputValues;

  const invoice = await invoiceModel.findById(invoiceId);

  /**
   * Find the whether the invoice exist in the database or not
   */

  if (!invoice) {
    throw new AppError(`There is no invoice with this ID ${invoiceId}`, 404);
  }

  if (invoice.documentId) {
    throw new AppError("This invoice already has a document", 400);
  }

  if (!req.cloudInvoice) {
    throw new AppError("Invoice file is required", 400);
  }

  const { error: reqError, value: requestValues } =
    invoiceDocumentFileValidation.validate(req.cloudInvoice);

  if (reqError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: reqError.details.map((detail) => detail.message),
    });
  }

  const { fileName, fileType, fileUrl,publicId  } = requestValues;

const newDocument = await documentModel.create({
  invoiceId,
  fileName,
  fileType,
  fileUrl,
  publicId,
  ocrText,
  uploadedAt,
});
  invoice.documentId = newDocument._id;
  await invoice.save();

  res.status(201).json({
    success: true,
    message: "Invoice document uploaded and linked successfully",
    data: newDocument,
  });
});
