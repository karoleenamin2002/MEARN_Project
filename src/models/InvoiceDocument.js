const mongoose = require('mongoose');

const invoiceDocumentSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'jpg', 'jpeg', 'png'], required: true },
    fileUrl: { type: String, required: true },
    ocrText: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InvoiceDocument', invoiceDocumentSchema);
