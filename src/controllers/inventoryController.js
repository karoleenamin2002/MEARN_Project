const InventoryTransaction = require('../models/InventoryTransaction');
const APIFeatures = require('../utils/apiFeatures');

// @desc    Get all transactions
// @route   GET /api/inventory-transactions
// @access  Private
exports.getTransactions = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      InventoryTransaction.find()
        .populate('productId', 'name barcode')
        .populate('sourceInvoiceId', 'invoiceNumber invoiceType'),
      req.query
    )
      .filter()
      .sort()
      .paginate();

    const transactions = await features.query;
    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    next(error);
  }
};

// @desc    Get transactions for specific product
// @route   GET /api/inventory-transactions/product/:productId
// @access  Private
exports.getProductTransactions = async (req, res, next) => {
  try {
    const transactions = await InventoryTransaction.find({ productId: req.params.productId })
      .populate('sourceInvoiceId', 'invoiceNumber invoiceType')
      .sort('-createdAt');

    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    next(error);
  }
};
