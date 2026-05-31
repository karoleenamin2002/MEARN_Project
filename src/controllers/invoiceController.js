import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import APIFeatures from '../utils/apiFeatures.js';

const updateStock = async (session, items, invoiceType, invoiceId) => {
  for (const item of items) {
    if (!item.productId) continue;

    const product = await Product.findById(item.productId).session(session);
    if (!product) throw new Error(`Product ${item.productId} not found`);

    const quantityBefore = product.quantity;
    let quantityAfter;

    if (['purchase', 'sales_return'].includes(invoiceType)) {
      quantityAfter = quantityBefore + item.quantity;
    } else {
      quantityAfter = quantityBefore - item.quantity;
      if (quantityAfter < 0) throw new Error(`Insufficient stock for ${product.name}`);
    }

    await Product.findByIdAndUpdate(item.productId, { quantity: quantityAfter }, { session });

    await InventoryTransaction.create(
      [{ productId: item.productId, transactionType: invoiceType, quantity: item.quantity, quantityBefore, quantityAfter, sourceInvoiceId: invoiceId, notes: 'Auto from invoice' }],
      { session }
    );
  }
};

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
export const getInvoices = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      Invoice.find().populate('clientId', 'name type').populate('uploadedBy', 'name'),
      req.query
    ).filter().sort().paginate();

    const invoices = await features.query;
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
export const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId', 'name phone type')
      .populate('uploadedBy', 'name email')
      .populate('documentId');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Create invoice (with stock update in transaction)
// @route   POST /api/invoices
// @access  Private
export const createInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [invoice] = await Invoice.create([{ ...req.body, uploadedBy: req.user._id }], { session });

    if (['purchase', 'sale', 'purchase_return', 'sales_return'].includes(invoice.invoiceType)) {
      await updateStock(session, invoice.items, invoice.invoiceType, invoice._id);
    }

    await session.commitTransaction();
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private/Admin
export const updateInvoice = async (req, res, next) => {
  try {
    const { invoiceDate, vendorName, clientId, paymentMethod } = req.body;
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { invoiceDate, vendorName, clientId, paymentMethod },
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private/Admin
export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invoices stats
// @route   GET /api/invoices/stats
// @access  Private
export const getStats = async (req, res, next) => {
  try {
    const stats = await Invoice.aggregate([
      { $group: { _id: '$invoiceType', count: { $sum: 1 }, totalAmount: { $sum: '$finalAmount' } } },
    ]);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};
