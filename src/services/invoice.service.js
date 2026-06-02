import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Branch from "../models/Branch.js";
import Product from "../models/Product.js";
import InventoryTransaction from "../models/InventoryTransaction.js";

//  Constants 
const INVOICE_TYPE_PREFIX = {
  purchase        : "PUR",
  sale            : "SAL",
  purchase_return : "PRE",
  sales_return    : "SRE",
  expense         : "EXP",
};

const RETURN_TYPES    = ["purchase_return", "sales_return"];
const INVENTORY_TYPES = ["purchase", "sale", "purchase_return", "sales_return"];

 
// Helpers

// Always remember fuck accounting.

//   Round a number to 2 decimal places.
 
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute all invoice amounts from raw inputs.
 * Returns: { baseAmount, taxPercentage, taxAmount, finalAmount,
 *            amountPaid, changeAmount, dueAmount }
 */
const computeAmounts = ({ baseAmount, taxPercentage = 0, amountPaid = 0 }) => {
  const base   = round2(baseAmount);
  const taxPct = round2(taxPercentage);
  const taxAmt = round2((base * taxPct) / 100);
  const final  = round2(base + taxAmt);
  const paid   = round2(amountPaid);
  const change = paid >= final ? round2(paid - final) : 0;
  const due    = paid <  final ? round2(final - paid) : 0;

  return {
    baseAmount    : base,
    taxPercentage : taxPct,
    taxAmount     : taxAmt,
    finalAmount   : final,
    amountPaid    : paid,
    changeAmount  : change,
    dueAmount     : due,
  };
};

/**
 generateInvoiceNumber

 */
const generateInvoiceNumber = async (invoiceType, session) => {
  const prefix = INVOICE_TYPE_PREFIX[invoiceType];
  const year   = new Date().getFullYear();
  const key    = `${invoiceType}-${year}`;

  const counter = await mongoose.connection.collection("invoicecounters").findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session }
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
  // تبا للمحاسبة 
  const txDocs     = [];
  const isIncoming = invoiceType === "purchase" || invoiceType === "sales_return";
  const isOutgoing = invoiceType === "sale"     || invoiceType === "purchase_return";

  for (const item of items) {
    const productEntry = branch.products.find(
      (p) => p.product.toString() === item.productId.toString()
    );

    if (!productEntry) {
      throw Object.assign(
        new Error(`Product ${item.productId} not found in branch ${branch._id}`),
        { statusCode: 404 }
      );
    }

    // Snapshot quantity BEFORE any mutation so the transaction log is accurate
    const qtyBefore = productEntry.quantity;

    if (isOutgoing && qtyBefore < item.quantity) {
      throw Object.assign(
        new Error(
          `Insufficient stock for product "${item.productName}". ` +
          `Available: ${qtyBefore}, Requested: ${item.quantity}`
        ),
        { statusCode: 422 }
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
    txDocs.push({
      productId       : item.productId,
      transactionType : invoiceType,
      quantity        : item.quantity,
      quantityBefore  : qtyBefore,
      quantityAfter   : productEntry.quantity,
      sourceInvoiceId : invoiceId,
      notes           : `Auto — ${invoiceType} invoice`,
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
      clientId         = null,
      paymentMethod,
      //saleSource : pos or MANUAL
      saleSource       = null,
      items            = [],
      relatedInvoiceId = null,
      documentId       = null,
      cashierId        = null,
      notes            = null,
      taxPercentage    = 0,
      amountPaid       = 0,
    } = body;

    // ── 1. Validate return invoice references original ──────────────────
    if (RETURN_TYPES.includes(invoiceType)) {
      const original = await Invoice.findById(relatedInvoiceId).session(session);

      if (!original) {
        throw Object.assign(
          new Error("Related invoice not found"),
          { statusCode: 404 }
        );
      }

      if (original.isCancelled) {
  throw Object.assign(
    new Error("Cannot create return for a cancelled invoice"),
    { statusCode: 422 }
  );
}

      // Validate invoice type
      if (
        invoiceType === "purchase_return" &&
        original.invoiceType !== "purchase"
      ) {
        throw Object.assign(
          new Error("Purchase return must reference a purchase invoice"),
          { statusCode: 422 }
        );
      }

      if (
        invoiceType === "sales_return" &&
        original.invoiceType !== "sale"
      ) {
        throw Object.assign(
          new Error("Sales return must reference a sale invoice"),
          { statusCode: 422 }
        );
      }

      // Validate returned products and quantities
      for (const item of items) {
        const originalItem = original.items.find(
          (i) => i.productId.toString() === item.productId.toString()
        );

        if (!originalItem) {
          throw Object.assign(
            new Error(
              `Product ${item.productName} does not exist in original invoice`
            ),
            { statusCode: 422 }
          );
        }

        if (item.quantity > originalItem.quantity) {
          throw Object.assign(
            new Error(
              `Return quantity exceeds original invoice quantity for product "${item.productName}"`
            ),
            { statusCode: 422 }
          );
        }
      }
    }

    // ── 2. Derive item totals and baseAmount server-side (never use client)
  //  انا جامد في اختيار المصطلحات والاسماء عموما
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
    products.map((p) => [p._id.toString(), p.sellPrice])
  );

  sanitizedItems = items.map((item) => {
    const sellPrice = priceMap.get(item.productId.toString());

    if (sellPrice === undefined) {
      throw Object.assign(
        new Error(`Product ${item.productId} not found`),
        { statusCode: 404 }
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

const baseAmount = sanitizedItems.reduce(
  (sum, item) => round2(sum + item.totalPrice),
  0
);

const amounts = computeAmounts({
  baseAmount,
  taxPercentage,
  amountPaid,
});

    // ── 3. Generate invoice number ──────────────────────────────────────
    const invoiceNumber = await generateInvoiceNumber(invoiceType, session);

    // ── 4. Load branch ( for inventory) ──────────────────────────
    let branch = null;
    if (INVENTORY_TYPES.includes(invoiceType)) {
      branch = await Branch.findById(branchId).session(session);
      if (!branch) {
        throw Object.assign(
          new Error("Branch not found"),
          { statusCode: 404 }
        );
      }
    }

    // ── 5. Guard: duplicate productId within items ──────────────────────
    if (sanitizedItems.length > 0) {
      const seen = new Set();
      for (const item of sanitizedItems) {
        const id = item.productId.toString();
        if (seen.has(id)) {
          throw Object.assign(
            new Error(`Duplicate productId ${id} in items — merge quantities instead`),
            { statusCode: 422 }
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
          ...amounts,
          items          : sanitizedItems,
          relatedInvoiceId,
          documentId,
          cashierId,
          createdBy,
          notes,
        },
      ],
      { session }
    );

    // ── 7. Apply inventory changes  ───────────────
    if (INVENTORY_TYPES.includes(invoiceType) && sanitizedItems.length > 0) {
      await applyInventoryChanges({
        branch,
        items     : sanitizedItems,
        invoiceType,
        invoiceId : invoice._id,
        session,
      });
    }

    await session.commitTransaction();
    return invoice;

  } catch (err) {
    await session.abortTransaction();
    // Translate MongoDB duplicate key error on invoiceNumber into a clear 409
    if (err.code === 11000 && err.keyPattern?.invoiceNumber) {
      throw Object.assign(
        new Error("Invoice number conflict — please retry"),
        { statusCode: 409 }
      );
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
    from,
    to,
    page  = 1,
    limit = 20,
    includeCancelled,
  } = query;

const filter = {};

if (includeCancelled !== "true") {
  filter.isCancelled = false;
}
  if (invoiceType)   filter.invoiceType   = invoiceType;
  if (branchId)      filter.branchId      = branchId;
  if (clientId)      filter.clientId      = clientId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (saleSource)    filter.saleSource    = saleSource;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(to);
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Invoice.countDocuments(filter);

  const invoices = await Invoice.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("branchId",  "name")
    .populate("clientId",  "name phone")
    .populate("createdBy", "name email")
    .populate("cashierId", "name email")
    .lean({ virtuals: true });

  return {
    total,
    page  : Number(page),
    limit : Number(limit),
    pages : Math.ceil(total / Number(limit)),
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
    .populate("branchId",         "name address")
    .populate("clientId",         "name phone type")
    .populate("createdBy",        "name email")
    .populate("cashierId",        "name email")
    .populate("relatedInvoiceId", "invoiceNumber invoiceType")
    .populate("documentId",       "fileName fileUrl fileType")
    .populate("items.productId",  "name barcode category")
    .lean({ virtuals: true });

  if (!invoice) {
    throw Object.assign(
      new Error("Invoice not found"),
      { statusCode: 404 }
    );
  }

  return invoice;
};

export const cancelInvoice = async (invoiceId, cancelledBy, reason = null) => {
  const session = await Invoice.startSession();
  session.startTransaction();

  try {
    const invoice = await Invoice.findById(invoiceId).session(session);

    if (!invoice) {
      throw Object.assign(
        new Error("Invoice not found"),
        { statusCode: 404 }
      );
    }

    if (invoice.isCancelled) {
      throw Object.assign(
        new Error("Invoice already cancelled"),
        { statusCode: 409 }
      );
    }

    const activeReturn = await Invoice.findOne({
  relatedInvoiceId: invoice._id,
  isCancelled: false,
}).session(session);

if (activeReturn) {
  throw Object.assign(
    new Error(
      "Cannot cancel invoice because it has active return invoices"
    ),
    { statusCode: 422 }
  );
}

    
    if (INVENTORY_TYPES.includes(invoice.invoiceType)) {
      const branch = await Branch.findById(invoice.branchId).session(session);

      if (!branch) {
        throw Object.assign(
          new Error("Branch not found"),
          { statusCode: 404 }
        );
      }

      const txDocs = [];

      for (const item of invoice.items) {
        const productEntry = branch.products.find(
          (p) => p.product.toString() === item.productId.toString()
        );

        if (!productEntry) {
          throw Object.assign(
            new Error(`Product ${item.productId} not found in branch`),
            { statusCode: 404 }
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
                  `Cannot cancel purchase invoice. Product "${item.productName}" stock is lower than purchased quantity`
                ),
                { statusCode: 422 }
              );
            }
            productEntry.quantity -= item.quantity;
            break;

          case "sales_return":
            if (qtyBefore < item.quantity) {
              throw Object.assign(
                new Error(
                  `Cannot cancel sales return. Product "${item.productName}" stock is insufficient`
                ),
                { statusCode: 422 }
              );
            }
            productEntry.quantity -= item.quantity;
            break;

          case "purchase_return":
            productEntry.quantity += item.quantity;
            break;
        }

        txDocs.push({
          productId: item.productId,
          transactionType: "invoice_cancel",
          quantity: item.quantity,
          quantityBefore: qtyBefore,
          quantityAfter: productEntry.quantity,
          sourceInvoiceId: invoice._id,
          notes: `Invoice cancelled (${invoice.invoiceNumber}) - ${reason}`
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
