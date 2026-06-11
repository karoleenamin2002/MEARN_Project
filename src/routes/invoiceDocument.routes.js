import express from "express";
import { uploadInvoice } from "../config/uploadConfig.js";
import { uploadToCloud } from "../middleware/uploadToCloud.js";
import { createInvoiceDocument } from "../controllers/invoiceDocumentController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/", protect, uploadInvoice, uploadToCloud, createInvoiceDocument);

export default router;