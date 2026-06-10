import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Client from "../models/Client.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import ClientBalanceTransaction from "../models/ClientBalanceTransaction.js";

// Helpers

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Build a PaymentTransaction document (not yet saved).
 * Kept as a plain object so callers can insertMany inside a session.
 */
const buildPaymentTxDoc = ({
  invoiceId,
  clientId,
  branchId,
  amount,
  paymentMethod,
  source,
  direction = "in",
  paidBy,
  notes = null,
}) => ({
  invoiceId,
  clientId: clientId ?? null,
  branchId,
  amount,
  paymentMethod,
  source,
  direction,
  paidBy,
  notes,
});

// ── Service Methods ────────────────────────────────────────────────────────

/**
 * Called from within invoice.service.js createInvoice — NOT a standalone route.
 *
 * Creates a PaymentTransaction record for the initial amountPaid on an invoice.
 * Handles overpayment → ClientBalanceTransaction + client.currentBalance update.
 * @param {Object} params
 * @param {Object} params.invoice   - Saved Invoice document
 * @param {mongoose.ClientSession} params.session
 * @param {ObjectId} params.createdBy
 */
export const recordInitialPayment = async ({
  invoice,
  session,
  createdBy,
  initialOverpayment = 0,
}) => {
  if (!invoice.amountPaid || invoice.amountPaid <= 0) return;

  const paymentDoc = buildPaymentTxDoc({
    invoiceId: invoice._id,
    clientId: invoice.clientId,
    branchId: invoice.branchId,
    amount: invoice.amountPaid,
    paymentMethod: invoice.paymentMethod,
    direction: "in",
    source: "invoice_creation",
    paidBy: createdBy,
  });

  await PaymentTransaction.create([paymentDoc], { session });

  // Create receivable balance for unpaid amount
  if (invoice.clientId && invoice.dueAmount > 0) {
    const client = await Client.findById(invoice.clientId).session(session);

    if (!client) {
      throw Object.assign(new Error("Client not found"), {
        statusCode: 404,
      });
    }

    client.currentBalance = round2(client.currentBalance + invoice.dueAmount);

    await client.save({ session });

    await ClientBalanceTransaction.create(
      [
        {
          clientId: client._id,
          amount: invoice.dueAmount,
          effect: "debit",
          type: "invoice_due",
          balanceAfter: client.currentBalance,
          sourceInvoiceId: invoice._id,
          createdBy,
          notes: `Outstanding balance from invoice ${invoice.invoiceNumber}`,
        },
      ],

      { session },
    );
 
  }
     if (invoice.clientId && initialOverpayment > 0) {
      await _applyOverpaymentCredit({
        clientId: invoice.clientId,
        invoiceId: invoice._id,
        amount: initialOverpayment,
        createdBy,
        session,
      });
    }
};

/**
 * POST /api/payments
 *
 * Records a payment against an existing (non-cancelled) invoice.
 * Recalculates amountPaid / dueAmount on the invoice.
 * Converts any overpayment into a ClientBalanceTransaction credit.
 *
 * @param {Object} body   - { invoiceId, amount, paymentMethod, notes }
 * @param {ObjectId} paidBy
 * @returns {Object}      - { invoice, paymentTransaction }
 */
export const createPayment = async (body, paidBy) => {
  const session = await Invoice.startSession();
  session.startTransaction();

  try {
    const { invoiceId, amount, paymentMethod, notes = null } = body;

    const parsedAmount = round2(Number(amount));

    //  1. Load invoice 
    const invoice = await Invoice.findById(invoiceId).session(session);

    if (!invoice) {
      throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }

    if (invoice.isCancelled) {
      throw Object.assign(
        new Error("Cannot record payment on a cancelled invoice"),
        { statusCode: 422 },
      );
    }
    // يعني لو ادفعت بالكامل
    if (invoice.dueAmount <= 0) {
      throw Object.assign(new Error("Invoice is already fully paid"), {
        statusCode: 422,
      });
    }

    //  2. Compute new totals 
    const oldDueAmount = invoice.dueAmount;
    const newAmountPaid = round2(invoice.amountPaid + parsedAmount);
    const excess =
      newAmountPaid > invoice.finalAmount
        ? round2(newAmountPaid - invoice.finalAmount)
        : 0;
        // هنا بحسب الباقي
    const newDueAmount =
      excess > 0 ? 0 : round2(invoice.finalAmount - newAmountPaid);

    // ─ 3. Update invoice 
    // amountPaid stores the full received amount — never capped at finalAmount.
    // This preserves the invariant: invoice.amountPaid ===  PaymentTransaction.amount
    invoice.amountPaid = newAmountPaid;
    invoice.dueAmount = newDueAmount;
    // changeAmount stays as-is (it was set at creation for cash-back; we don't
    // recalculate it for post-creation payments)
    await invoice.save({ session });

    //  4. Create PaymentTransaction 
    // دفعة إضافية بعد إنشاء الفاتورة
    const [paymentTx] = await PaymentTransaction.create(
      [
        buildPaymentTxDoc({
          invoiceId: invoice._id,
          clientId: invoice.clientId,
          branchId: invoice.branchId,
          amount: parsedAmount,
          paymentMethod,
          source: "manual_payment",
          direction: "in",
          paidBy,
          notes,
        }),
      ],
      { session },
    );

    //  5. Reduce client outstanding balance 

    if (invoice.clientId) {
      const client = await Client.findById(invoice.clientId).session(session);

      if (!client) {
        throw Object.assign(new Error("Client not found"), {
          statusCode: 404,
        });
      }

      // لا نقلل أكثر من المبلغ المستحق قبل الدفع
      const settledAmount = Math.min(parsedAmount, oldDueAmount);

      if (settledAmount > 0) {
        client.currentBalance = round2(client.currentBalance - settledAmount);

        await client.save({ session });

        await ClientBalanceTransaction.create(
          [
            {
              clientId: client._id,
              amount: settledAmount,
              effect: "credit",
              type: "manual_adjustment",
              balanceAfter: client.currentBalance,
              sourceInvoiceId: invoice._id,
              createdBy: paidBy,
              notes: `Payment settlement for invoice ${invoice.invoiceNumber}`,
            },
          ],
          { session },
        );
      }
    }

    //  5. Handle overpayment 
    if (excess > 0 && invoice.clientId) {
      await _applyOverpaymentCredit({
        clientId: invoice.clientId,
        invoiceId: invoice._id,
        amount: excess,
        createdBy: paidBy,
        session,
      });
    }

    await session.commitTransaction();

    return { invoice, paymentTransaction: paymentTx };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/payments
 *
 * Returns a paginated list of PaymentTransactions.
 * Filterable by invoiceId, clientId, branchId, source.
 */
export const getPayments = async (query) => {
  const {
    invoiceId,
    clientId,
    branchId,
    source,
    from,
    to,
    page = 1,
    limit = 20,
  } = query;

  const filter = {};
  if (invoiceId) filter.invoiceId = invoiceId;
  if (clientId) filter.clientId = clientId;
  if (branchId) filter.branchId = branchId;
  if (source) filter.source = source;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await PaymentTransaction.countDocuments(filter);

  const payments = await PaymentTransaction.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("invoiceId", "invoiceNumber invoiceType finalAmount dueAmount")
    .populate("clientId", "name phone")
    .populate("branchId", "name")
    .populate("paidBy", "name email")
    .lean();

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
    payments,
  };
};

/**
 * GET /api/clients/:id/balance
 *
 * Returns a client's currentBalance and their ClientBalanceTransaction history.
 */
export const getClientBalance = async (clientId, query) => {
  const client = await Client.findById(clientId)
    .select("name phone type currentBalance")
    .lean();

  if (!client) {
    throw Object.assign(new Error("Client not found"), { statusCode: 404 });
  }

  const { from, to, page = 1, limit = 20 } = query;
  const filter = { clientId };

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await ClientBalanceTransaction.countDocuments(filter);

  const transactions = await ClientBalanceTransaction.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("sourceInvoiceId", "invoiceNumber invoiceType finalAmount")
    .populate("createdBy", "name email")
    .lean();

  return {
    client,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
    transactions,
  };
};

// ── Exported service methods (continued) ──────────────────────────────────

/**
 * Called from within invoice.service.js cancelInvoice — NOT a standalone route.
 *
 * Reverses any overpayment credits tied to the cancelled invoice.
 * Minimal scope: only reverses ClientBalanceTransaction records of type
 * "overpayment" / effect "credit" for this invoice.
 *
 * Idempotent: exits immediately if a cancellation_reversal already exists
 * for this invoice.

 */
export const reverseCancelledInvoicePayments = async ({
  invoice,
  cancelledBy,
  session,
}) => {
  // Guard: invoices without a client skip balance logic entirely
  if (!invoice.clientId) return;
  // Idempotency: if reversal already recorded, do nothing
  const alreadyReversed = await ClientBalanceTransaction.exists({
    sourceInvoiceId: invoice._id,
    type: "cancellation_reversal",
  }).session(session);

  if (alreadyReversed) return;

  // Create payment reversal record for audit trail
  if (invoice.amountPaid > 0) {
  await PaymentTransaction.create([
  {
    invoiceId: invoice._id,
    clientId: invoice.clientId,
    branchId: invoice.branchId,
    amount: invoice.amountPaid,
    paymentMethod: invoice.paymentMethod,
    source: "cancellation_reversal",
    direction: "out",
    paidBy: cancelledBy,
    notes: `Payment reversed due to invoice cancellation (${invoice.invoiceNumber})`,
  },

],{ session });
  }

  // Find all overpayment credits for this invoice
  const overpayments = await ClientBalanceTransaction.find({
    sourceInvoiceId: invoice._id,
    type: "overpayment",
    effect: "credit",
  }).session(session);

  if (!overpayments.length) return;

  // Sum the total overpayment credit to reverse
  const totalToReverse = round2(
    overpayments.reduce((sum, tx) => sum + tx.amount, 0),
  );

  const client = await Client.findById(invoice.clientId).session(session);

  if (!client) {
    throw Object.assign(
      new Error("Client not found during cancellation reversal"),
      { statusCode: 404 },
    );
  }

  // debit: currentBalance increases (reverses the earlier credit)
  const newBalance = round2(client.currentBalance + totalToReverse);
  client.currentBalance = newBalance;
  await client.save({ session });

  await ClientBalanceTransaction.create(
    [
      {
        clientId: invoice.clientId,
        amount: totalToReverse, // always positive
        effect: "debit", // increases currentBalance (reverses the credit)
        type: "cancellation_reversal",
        balanceAfter: newBalance,
        sourceInvoiceId: invoice._id,
        createdBy: cancelledBy,
        notes: `Cancellation reversal for invoice`,
      },
    ],
    { session },
  );
};


const _applyOverpaymentCredit = async ({
  clientId,
  invoiceId,
  amount,
  createdBy,
  session,
}) => {
  const client = await Client.findById(clientId).session(session);

  if (!client) {
    throw Object.assign(new Error("Client not found for overpayment credit"), {
      statusCode: 404,
    });
  }

  // credit: currentBalance decreases (client paid extra, company now owes them)
  const newBalance = round2(client.currentBalance - amount);
  client.currentBalance = newBalance;
  await client.save({ session });

  await ClientBalanceTransaction.create(
    [
      {
        clientId,
        amount, // always positive
        effect: "credit", // decreases currentBalance
        type: "overpayment",
        balanceAfter: newBalance,
        sourceInvoiceId: invoiceId,
        createdBy,
        notes: `Overpayment credit from invoice`,
      },
    ],
    { session },
  );
};
