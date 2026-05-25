const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    invoiceType: {
      type: String,
      enum: ['purchase', 'sale', 'purchase_return', 'sales_return', 'expense'],
      required: [true, 'Invoice type is required'],
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    },
    vendorName: { type: String, trim: true },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },
    items: [invoiceItemSchema],
    baseAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'transfer', 'credit'],
      default: 'cash',
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvoiceDocument',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-generate invoice number before save
invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const prefix = {
      purchase: 'PUR',
      sale: 'SAL',
      purchase_return: 'PRR',
      sales_return: 'SRR',
      expense: 'EXP',
    }[this.invoiceType] || 'INV';

    const year = new Date().getFullYear();
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
