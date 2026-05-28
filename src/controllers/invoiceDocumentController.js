const InvoiceDocument = require('../models/InvoiceDocument');
const Invoice = require('../models/Invoice');
const path = require('path');

// @desc    Upload document for invoice
// @route   POST /api/invoice-documents
// @access  Private
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { invoiceId } = req.body;
    const ext = path.extname(req.file.originalname).slice(1).toLowerCase();

    const doc = await InvoiceDocument.create({
      invoiceId: invoiceId || null,
      fileName: req.file.originalname,
      fileType: ext,
      // In production → upload to Cloudinary and store the URL
      fileUrl: `/uploads/${req.file.filename}`,
    });

    // Link document back to invoice
    if (invoiceId) {
      await Invoice.findByIdAndUpdate(invoiceId, { documentId: doc._id });
    }

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

// @desc    Get document by id
// @route   GET /api/invoice-documents/:id
// @access  Private
exports.getDocument = async (req, res, next) => {
  try {
    const doc = await InvoiceDocument.findById(req.params.id).populate('invoiceId');
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete document
// @route   DELETE /api/invoice-documents/:id
// @access  Private/Admin
exports.deleteDocument = async (req, res, next) => {
  try {
    const doc = await InvoiceDocument.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
};
