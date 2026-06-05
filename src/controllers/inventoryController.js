import InventoryTransaction from "../models/InventoryTransaction.js";
import Branch from "../models/Branch.js";
import invoice from "../models/Invoice.js";

export const getInventoryTransactions = async (req, res, next) => {
  try {
    const { transactionType, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (transactionType) filter.transactionType = transactionType;

    if (from || to) {
      filter.createdAt = {};

      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const start = (Number(page) - 1) * Number(limit);
    const end = Number(page) * Number(limit);
    const total = await InventoryTransaction.countDocuments(filter);
    const results = {};
    results.total = total;
    if (page > 1) {
      results.prevPage = Number(page) - 1;
    }
    if (end < total) {
      results.nextPage = Number(page) + 1;
    }

    const transactions = await InventoryTransaction.find(filter)
      .populate("productId", "name barcode")
      .populate("sourceInvoiceId", "invoiceNumber invoiceType")
      .populate("branchId", "name")
      .sort({ createdAt: -1 })
      .skip(start)
      .limit(Number(limit));
    results.data = transactions;
    res.status(200).json({
      count: transactions.length,
      results: results,
    });
  } catch (err) {
    next(err);
  }
};

export const getProductTransactions = async (req, res, next) => {
  const { transactionType, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};
  filter.productId = req.params.id;
  if (transactionType) filter.transactionType = transactionType;

  if (from || to) {
    filter.createdAt = {};

    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const start = (Number(page) - 1) * Number(limit);
  const end = Number(page) * Number(limit);
  const total = await InventoryTransaction.countDocuments(filter);
  const results = {};
  results.total = total;
  const transactions = await InventoryTransaction.find(filter)
    .populate("productId", "name barcode")
    .populate("sourceInvoiceId", "invoiceNumber invoiceType")
    .populate("branchId", "name")
    .sort({ createdAt: -1 })
    .skip(start)
    .limit(Number(limit));
  results.data = transactions;
  res.status(200).json({
    count: transactions.length,
    results: results,
  });
};

export const getBranchTransactions = async (req, res, next) => {
  const { transactionType, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};
  filter.branchId = req.params.id;
  if (transactionType) filter.transactionType = transactionType;

  if (from || to) {
    filter.createdAt = {};

    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const start = (Number(page) - 1) * Number(limit);
  const end = Number(page) * Number(limit);
  const total = await InventoryTransaction.countDocuments(filter);
  const results = {};
  results.total = total;
  const transactions = await InventoryTransaction.find(filter)
    .populate("productId", "name barcode")
    .populate("sourceInvoiceId", "invoiceNumber invoiceType")
    .populate("branchId", "name")
    .sort({ createdAt: -1 })
    .skip(start)
    .limit(Number(limit));
  results.data = transactions;

  res.status(200).json({
    count: transactions.length,
    results: results,
  });
};

export const getProductTransactionsInBranch = async (req, res, next) => {
  const { transactionType, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};
  filter.branchId = req.params.branchId;
  filter.productId = req.params.productId;
  if (transactionType) filter.transactionType = transactionType;

  if (from || to) {
    filter.createdAt = {};

    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const start = (Number(page) - 1) * Number(limit);
  const end = Number(page) * Number(limit);
  const total = await InventoryTransaction.countDocuments(filter);
  const results = {};
  results.total = total;

  const transactions = await InventoryTransaction.find(filter)
    .populate("productId", "name barcode")
    .populate("sourceInvoiceId", "invoiceNumber invoiceType")
    .populate("branchId", "name")
    .sort({ createdAt: -1 })
    .skip(start)
    .limit(Number(limit));
  results.data = transactions;

  res.status(200).json({
    count: transactions.length,
    results: results,
  });
};
