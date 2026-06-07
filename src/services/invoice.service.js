import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Branch from "../models/Branch.js";
import Product from "../models/Product.js";
import InventoryTransaction from "../models/InventoryTransaction.js";
import {
  recordInitialPayment,
  reverseCancelledInvoicePayments,
} from "./payment.service.js";

//  Constants
const INVOICE_TYPE_PREFIX = {
  purchase: "PUR",
  sale: "SAL",
  purchase_return: "PRE",
  sales_return: "SRE",
  expense: "EXP",
};

const RETURN_TYPES = ["purchase_return", "sales_return"];
const INVENTORY_TYPES = ["purchase", "sale", "purchase_return", "sales_return"];

// Helpers

//   Round a number to 2 decimal places.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute all invoice amounts from raw inputs.
 * Returns: { baseAmount, taxPercentage, taxAmount, finalAmount,
 *            amountPaid, changeAmount, dueAmount }
 */
const computeAmounts = ({ baseAmount, taxPercentage = 0, amountPaid = 0 }) => {
  const base = round2(baseAmount);
  const taxPct = round2(taxPercentage);
  const taxAmt = round2((base * taxPct) / 100);
  const final = round2(base + taxAmt);
  const paid = round2(amountPaid);
  const change = paid >= final ? round2(paid - final) : 0;
  const due = paid < final ? round2(final - paid) : 0;

  return {
    baseAmount: base,
    taxPercentage: taxPct,
    taxAmount: taxAmt,
    finalAmount: final,
    amountPaid: paid,
    changeAmount: change,
    dueAmount: due,
  };
};

/**
 generateInvoiceNumber

 */
const generateInvoiceNumber = async (invoiceType, session) => {
  const prefix = INVOICE_TYPE_PREFIX[invoiceType];
  const year = new Date().getFullYear();
  const key = `${invoiceType}-${year}`;

  const counter = await mongoose.connection
    .collection("invoicecounters")
    .findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after", session },
    );

  const sequence = String(counter.seq).padStart(6, "0");
  return `${prefix}-${year}-${sequence}`;
};

// Core inventory update

const applyInventoryChanges = async ({
  branch,
  items,
  invoiceType,
  invoiceId,
  session,
}) => {
  const txDocs = [];
  const isIncoming =
    invoiceType === "purchase" || invoiceType === "sales_return";
  const isOutgoing =
    invoiceType === "sale" || invoiceType === "purchase_return";

  for (const item of items) {
    const productEntry = branch.products.find(
      (p) => p.product.toString() === item.productId.toString(),
    );

    if (!productEntry) {
      throw Object.assign(
        new Error(
          `Product ${item.productId} not found in branch ${branch._id}`,
        ),
        { statusCode: 404 },
      );
    }

    // Snapshot quantity BEFORE any mutation so the transaction log is accurate
    const qtyBefore = productEntry.quantity;

    if (isOutgoing && qtyBefore < item.quantity) {
      throw Object.assign(
        new Error(
          `Insufficient stock for product "${item.productName}". ` +
            `Available: ${qtyBefore}, Requested: ${item.quantity}`,
        ),
        { statusCode: 422 },
      );
    }

    // Apply mutation
    if (isIncoming) {
      productEntry.quantity += item.quantity;
    } else {
      productEntry.quantity -= item.quantity;
    }
    productEntry.lastUpdatedAt = new Date();

    // Build transaction record using pre-mutation snapshot
    // add branchId and name
    txDocs.push({
      productId: item.productId,
      productName: item.productName,
      branchId: branch._id,
      branchName: branch.name,
      transactionType: invoiceType,
      quantity: item.quantity,
      quantityBefore: qtyBefore,
      quantityAfter: productEntry.quantity,
      sourceInvoiceId: invoiceId,
      notes: `Auto — ${invoiceType} invoice`,
    });
  }

  await branch.save({ session });
  await InventoryTransaction.insertMany(txDocs, { session });
};

// Service Methods

/**
 * POST /invoices
 * Creates an invoice, updates branch inventory, and logs transactions.
 */
export const createInvoice = async (body, createdBy) => {
  const session = await Invoice.startSession();
  session.startTransaction();

  try {
    const {
      invoiceType,
      branchId,
      clientId = null,
      paymentMethod,

      saleSource = null,

      expenseName = null,
      expenseType = null,
      expenseDescription = null,
      expenseOtherNotes = null,

      items = [],

      relatedInvoiceId = null,
      documentId = null,
      cashierId = null,

      notes = null,

      taxPercentage = 0,
      amountPaid = 0,
      baseAmount: expenseBaseAmount = null,
    } = body;

    // ── 1. Validate return invoice references original ──────────────────
    if (RETURN_TYPES.includes(invoiceType)) {
      const original =
        await Invoice.findById(relatedInvoiceId).session(session);

      if (!original) {
        throw Object.assign(new Error("Related invoice not found"), {
          statusCode: 404,
        });
      }

      if (original.isCancelled) {
        throw Object.assign(
          new Error("Cannot create return for a cancelled invoice"),
          { statusCode: 422 },
        );
      }

      // Validate invoice type
      if (
        invoiceType === "purchase_return" &&
        original.invoiceType !== "purchase"
      ) {
        throw Object.assign(
          new Error("Purchase return must reference a purchase invoice"),
          { statusCode: 422 },
        );
      }

      if (invoiceType === "sales_return" && original.invoiceType !== "sale") {
        throw Object.assign(
          new Error("Sales return must reference a sale invoice"),
          { statusCode: 422 },
        );
      }

      // Validate returned products and quantities
      const previousReturns = await Invoice.find({
        relatedInvoiceId: original._id,
        invoiceType,
        isCancelled: false,
      })
        .select("items")
        .session(session);
      for (const item of items) {
        const originalItem = original.items.find(
          (i) => i.productId.toString() === item.productId.toString(),
        );

        const alreadyReturnedQty = previousReturns.reduce((sum, ret) => {
          const returnedItem = ret.items.find(
            (i) => i.productId.toString() === item.productId.toString(),
          );

          return sum + (returnedItem?.quantity || 0);
        }, 0);

        if (!originalItem) {
          throw Object.assign(
            new Error(
              `Product ${item.productName} does not exist in original invoice`,
            ),
            { statusCode: 422 },
          );
        }

        if (round2(item.unitPrice) !== round2(originalItem.unitPrice)) {
          throw Object.assign(
            new Error(
              `Returned item price does not match original invoice price for "${item.productName}". Original: ${originalItem.unitPrice}, Received: ${item.unitPrice}`,
            ),
            {
              statusCode: 422,
            },
          );
        }

        if (alreadyReturnedQty + item.quantity > originalItem.quantity) {
          throw Object.assign(
            new Error(
              `Return quantity exceeds remaining quantity for product "${item.productName}". Original: ${originalItem.quantity}, Already Returned: ${alreadyReturnedQty}, Requested: ${item.quantity}`,
            ),
            {
              statusCode: 422,
            },
          );
        }
      }
    }

    // ── 2. Derive item totals and baseAmount server-side (never use  pos)
    let sanitizedItems = [];

    if (invoiceType === "sale" && saleSource === "POS") {
      const productIds = items.map((i) => i.productId);

      const products = await Product.find({
        _id: { $in: productIds },
      })
        .select("sellPrice")
        // Plain Object بدل Mongoose Document

        .lean();

      const priceMap = new Map(
        products.map((p) => [p._id.toString(), p.sellPrice]),
      );

      sanitizedItems = items.map((item) => {
        const sellPrice = priceMap.get(item.productId.toString());

        if (sellPrice === undefined) {
          throw Object.assign(
            new Error(`Product ${item.productId} not found`),
            { statusCode: 404 },
          );
        }

        return {
          ...item,
          unitPrice: sellPrice,
          totalPrice: round2(item.quantity * sellPrice),
        };
      });
      // لو فاتورة من نوع تاني استخدم اليونت برايس
    } else {
      sanitizedItems = items.map((item) => ({
        ...item,
        totalPrice: round2(item.quantity * item.unitPrice),
      }));
    }

    let baseAmount;

    if (invoiceType === "expense") {
      baseAmount = round2(Number(expenseBaseAmount || 0));
    } else {
      baseAmount = sanitizedItems.reduce(
        (sum, item) => round2(sum + item.totalPrice),
        0,
      );
    }

    const amounts = computeAmounts({
      baseAmount,
      taxPercentage,
      amountPaid,
    });

    let initialOverpayment = 0;

    if (saleSource !== "POS" && amounts.amountPaid > amounts.finalAmount) {
      initialOverpayment = round2(amounts.amountPaid - amounts.finalAmount);

      amounts.changeAmount = 0;
    }

    if (
      invoiceType === "sale" &&
      saleSource === "POS" &&
      amounts.dueAmount > 0
    ) {
      throw Object.assign(new Error("POS sales must be paid in full"), {
        statusCode: 422,
      });
    }

    // ── 3. Generate invoice number ──────────────────────────────────────
    const invoiceNumber = await generateInvoiceNumber(invoiceType, session);

    // ── 4. Load branch ( for inventory) ──────────────────────────
    let branch = null;
    if (INVENTORY_TYPES.includes(invoiceType)) {
      branch = await Branch.findById(branchId).session(session);
      if (!branch) {
        throw Object.assign(new Error("Branch not found"), { statusCode: 404 });
      }
    }

    // ── 5. Guard: duplicate productId within items ──────────────────────
    if (sanitizedItems.length > 0) {
      // set بتاخد القيم الغير متكررة
      const seen = new Set();
      for (const item of sanitizedItems) {
        const id = item.productId.toString();
        if (seen.has(id)) {
          throw Object.assign(
            new Error(
              `Duplicate productId ${id} in items — merge quantities instead`,
            ),
            { statusCode: 422 },
          );
        }
        seen.add(id);
      }
    }

    // ── 6. Create invoice document ──────────────────────────────────────
    const [invoice] = await Invoice.create(
      [
        {
          invoiceType,
          invoiceNumber,
          branchId,
          clientId,
          paymentMethod,
          saleSource,
          expenseName,
          expenseType,
          expenseDescription,
          expenseOtherNotes,
          ...amounts,
          items: sanitizedItems,
          relatedInvoiceId,
          documentId,
          cashierId,
          createdBy,
          notes,
        },
      ],
      { session },
    );

    // ── 7. Apply inventory changes  ───────────────
    if (INVENTORY_TYPES.includes(invoiceType) && sanitizedItems.length > 0) {
      await applyInventoryChanges({
        branch,
        items: sanitizedItems,
        invoiceType,
        invoiceId: invoice._id,
        session,
      });
    }

    // ── 8. Record initial payment (if amountPaid > 0)
    // هنا نقطة الربط مع payment
    await recordInitialPayment({
      invoice,
      session,
      createdBy,
      initialOverpayment,
    });

    await session.commitTransaction();
    return invoice;
  } catch (err) {
    await session.abortTransaction();
    // Translate MongoDB duplicate key error on invoiceNumber into a clear 409
    if (err.code === 11000 && err.keyPattern?.invoiceNumber) {
      throw Object.assign(new Error("Invoice number conflict — please retry"), {
        statusCode: 409,
      });
    }
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /invoices
 * Returns a paginated, filtered list of invoices.
 */
export const getInvoices = async (query) => {
  const {
    invoiceType,
    branchId,
    clientId,
    paymentMethod,
    saleSource,
    expenseType,
    paymentStatus,
    from,
    to,
    page = 1,
    limit = 20,
    includeCancelled,
  } = query;

  const filter = {};

  if (includeCancelled !== "true") {
    filter.isCancelled = false;
  }
  if (invoiceType) filter.invoiceType = invoiceType;
  if (branchId) filter.branchId = branchId;
  if (clientId) filter.clientId = clientId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (saleSource) filter.saleSource = saleSource;
  if (expenseType) filter.expenseType = expenseType;

  // Payment status filter
  if (paymentStatus === "paid") {
    filter.dueAmount = 0;
  }

  if (paymentStatus === "partial") {
    filter.amountPaid = { $gt: 0 };
    filter.dueAmount = { $gt: 0 };
  }

  if (paymentStatus === "unpaid") {
    filter.amountPaid = 0;
    filter.dueAmount = { $gt: 0 };
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Invoice.countDocuments(filter);

  const invoices = await Invoice.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("branchId", "name")
    .populate("clientId", "name phone")
    .populate("createdBy", "name email")
    .populate("cashierId", "name email")
    .lean({ virtuals: true });

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
    invoices,
  };
};

// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /invoices/:id
 * Returns a single invoice with full population.
 */
export const getInvoiceById = async (id) => {
  const invoice = await Invoice.findById(id)
    .populate("branchId", "name address")
    .populate("clientId", "name phone type")
    .populate("createdBy", "name email")
    .populate("cashierId", "name email")
    .populate("relatedInvoiceId", "invoiceNumber invoiceType")
    .populate("documentId", "fileName fileUrl fileType")
    .populate("items.productId", "name barcode category")
    .lean({ virtuals: true });

  if (!invoice) {
    throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
  }

  return invoice;
};
// cancelInvoice
export const cancelInvoice = async (invoiceId, cancelledBy, reason = null) => {
  const session = await Invoice.startSession();
  session.startTransaction();

  try {
    const invoice = await Invoice.findById(invoiceId).session(session);

    if (!invoice) {
      throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }

    if (RETURN_TYPES.includes(invoice.invoiceType)) {
      throw Object.assign(new Error("Return invoices cannot be cancelled"), {
        statusCode: 422,
      });
    }

    if (invoice.isCancelled) {
      throw Object.assign(new Error("Invoice already cancelled"), {
        statusCode: 409,
      });
    }

    const activeReturn = await Invoice.findOne({
      relatedInvoiceId: invoice._id,
      isCancelled: false,
    }).session(session);

    if (activeReturn) {
      throw Object.assign(
        new Error(
          "Cannot cancel invoice because it has active return invoices",
        ),
        { statusCode: 422 },
      );
    }

    // Reverse any overpayment credits tied to this invoice
    await reverseCancelledInvoicePayments({
      invoice,
      cancelledBy,
      session,
    });

    if (INVENTORY_TYPES.includes(invoice.invoiceType)) {
      const branch = await Branch.findById(invoice.branchId).session(session);

      if (!branch) {
        throw Object.assign(new Error("Branch not found"), { statusCode: 404 });
      }

      const txDocs = [];

      for (const item of invoice.items) {
        const productEntry = branch.products.find(
          (p) => p.product.toString() === item.productId.toString(),
        );

        if (!productEntry) {
          throw Object.assign(
            new Error(`Product ${item.productId} not found in branch`),
            { statusCode: 404 },
          );
        }

        const qtyBefore = productEntry.quantity;

        switch (invoice.invoiceType) {
          case "sale":
            productEntry.quantity += item.quantity;
            break;

          case "purchase":
            if (qtyBefore < item.quantity) {
              throw Object.assign(
                new Error(
                  `Cannot cancel purchase invoice. Product "${item.productName}" stock is lower than purchased quantity`,
                ),
                { statusCode: 422 },
              );
            }
            productEntry.quantity -= item.quantity;
            break;

          case "sales_return":
            if (qtyBefore < item.quantity) {
              throw Object.assign(
                new Error(
                  `Cannot cancel sales return. Product "${item.productName}" stock is insufficient`,
                ),
                { statusCode: 422 },
              );
            }
            productEntry.quantity -= item.quantity;
            break;

          case "purchase_return":
            productEntry.quantity += item.quantity;
            break;
        }
        // add branchId and name
        txDocs.push({
          productId: item.productId,
          productName: item.productName,
          branchId: invoice.branchId,
          branchName: branch.name,
          transactionType: "invoice_cancel",
          quantity: item.quantity,
          quantityBefore: qtyBefore,
          quantityAfter: productEntry.quantity,
          sourceInvoiceId: invoice._id,
          notes: `Invoice cancelled (${invoice.invoiceNumber}) - ${reason}`,
        });
      }

      await branch.save({ session });
      await InventoryTransaction.insertMany(txDocs, { session });
    }

    invoice.isCancelled = true;
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = cancelledBy;
    invoice.cancellationReason = reason;

    await invoice.save({ session });

    await session.commitTransaction();

    return invoice;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};
