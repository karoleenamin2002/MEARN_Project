import InventoryTransaction from "../models/InventoryTransaction.js";
import Branch from "../models/Branch.js";
import invoice from "../models/Invoice.js";

const getTransactions = async (IDs, queryParams) => {
  const { transactionType, from, to, page = 1, limit = 20 } = queryParams;
  const filter = { ...IDs };

  if (transactionType) filter.transactionType = transactionType;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const start = (Number(page) - 1) * Number(limit);
  const end = Number(page) * Number(limit);

  const total = await InventoryTransaction.countDocuments(filter);
  const transactions = await InventoryTransaction.find(filter)
    .populate("productId", "name barcode")
    .populate("sourceInvoiceId", "invoiceNumber invoiceType")
    .populate("branchId", "name")
    .sort({ createdAt: -1 })
    .skip(start)
    .limit(Number(limit));
  const results = {};
  results.total = total;
  results.data = transactions;
  if (Number(page) > 1) results.prevPage = Number(page) - 1;
  if (end < total) results.nextPage = Number(page) + 1;

  return {
    count: transactions.length,
    results,
  };
};

export const getInventoryTransactions = async (req, res, next) => {
  try {
    const response = await getTransactions({}, req.query);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

export const getProductTransactions = async (req, res, next) => {
  try {
    const response = await getTransactions(
      { productId: req.params.id },
      req.query,
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

export const getBranchTransactions = async (req, res, next) => {
  try {
    const response = await getTransactions(
      { branchId: req.params.id },
      req.query,
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

export const getProductTransactionsInBranch = async (req, res, next) => {
  try {
    const response = await getTransactions(
      {
        productId: req.params.productId,
        branchId: req.params.branchId,
      },
      req.query,
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};
