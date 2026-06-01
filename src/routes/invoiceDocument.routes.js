import express from "express";
import { uploadInvoice } from "../config/uploadConfig.js";
import { uploadToCloud } from "../middleware/uploadToCloud.js";
import { createInvoiceDocument } from "../controllers/invoiceDocumentController.js";

const router = express.Router();

/**
 * @route   POST /api/upload-invoice
 * @desc    Uploading an invoice
 * @access  Private/Admin
 */
router.post("/", uploadInvoice, uploadToCloud, createInvoiceDocument);

export default router;
