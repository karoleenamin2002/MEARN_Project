import { catchError } from "../middleware/catchError.js";
import {
  invoiceDocumentUpdateValidation,
  invoiceDocumentValidation,
} from "../models/InvoiceDocument/InvoiceDocumentValidation.js";
import documentModel from "../models/InvoiceDocument/InvoiceDocument.js";
import invoiceModel from "../models/Invoice.js";
import AppError from "../middleware/appError.js";

export const createInvoiceDocument = catchError(async (req, res) => {
  const { error, value: inputValues } = invoiceDocumentUpdateValidation.validate(
    req.body,
  );
  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((detail) => detail.message),
    });
  }
  console.log(inputValues);
  const { invoiceId, ocrText, uploadedAt } = inputValues;

  /**
   * Find the whether the invoice exist in the database or not
   */
  const invoice = await invoiceModel.findById(invoiceId);
  if (!invoice)
    throw new AppError(`There is no invoice with this ID ${invoiceId}`, 404);
  const { error: reqError, value: requestValues } =
    invoiceDocumentUpdateValidation.validate(req.cloudInvoice);
  if (reqError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: reqError.details.map((detail) => detail.message),
    });
  }

  const { fileName, fileType, fileUrl } = requestValues;

  const newDocument = await documentModel.create({
    invoiceId,
    fileName,
    fileType,
    fileUrl,
    ocrText,
    uploadedAt,
  });

  res.status(201).json(newDocument);
});
