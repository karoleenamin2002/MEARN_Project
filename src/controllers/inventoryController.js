import InventoryTransaction from "../models/InventoryTransaction.js";
import APIFeatures from "../utils/apiFeatures.js";
import { adjustInventory } from "../services/inventoryAdjustment.service.js";

// @desc    Get all transactions
// @route   GET /api/inventory-transactions
// @access  Private
export const getTransactions = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      InventoryTransaction.find()
        .populate("productId", "name barcode")
        .populate("branchId", "name")
        .populate("sourceInvoiceId", "invoiceNumber invoiceType")
        .populate("createdBy", "name email"),
      req.query,
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
export const getProductTransactions = async (req, res, next) => {
  try {
    const transactions = await InventoryTransaction.find({
      productId: req.params.productId,
    })
      .populate("branchId", "name")
      .populate("sourceInvoiceId", "invoiceNumber invoiceType")
      .populate("createdBy", "name email")
      .sort("-createdAt");

    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    next(error);
  }
};

// @desc    Adjust branch inventory after manual stock count
// @route   POST /api/inventory-transactions/adjust
// @access  Private
export const adjustInventoryController = async (req, res, next) => {
  try {
    const transaction = await adjustInventory(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Inventory adjusted successfully",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};
