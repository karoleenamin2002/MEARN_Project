import mongoose from "mongoose";

// effect: "credit" = client balance increases (company owes client more / client's debt reduces)
//         "debit"  = client balance decreases (client owes company more)
//
// Amounts are always stored as positive numbers.
// The `effect` field determines direction.
//
// Used ONLY for exceptional balance events:
//   overpayment       → credit  (client paid more than invoice total)
//   refund            → credit  (company returning money to client)
//   cancellation_reversal → credit or debit depending on context
//   manual_adjustment → credit or debit as needed

const BALANCE_TRANSACTION_TYPES = [
  "invoice_due",
  "overpayment",
  "refund",
  "cancellation_reversal",
  "manual_adjustment",
];

const clientBalanceTransactionSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "clientId is required"],
    },

    // Always positive — use effect for direction
    amount: {
      type: Number,
      required: [true, "amount is required"],
      min: [0.01, "amount must be greater than zero"],
    },

    // credit = currentBalance decreases (company owes client / client's debt reduces)
    // debit  = currentBalance increases  (client owes company more)
    effect: {
      type: String,
      enum: {
        values: ["credit", "debit"],
        message: "effect must be either credit or debit",
      },
      required: [true, "effect is required"],
    },

    type: {
      type: String,
      enum: {
        values: BALANCE_TRANSACTION_TYPES,
        message: `type must be one of: ${BALANCE_TRANSACTION_TYPES.join(", ")}`,
      },
      required: [true, "type is required"],
    },

    // Snapshot of client.currentBalance AFTER this transaction was applied
    balanceAfter: {
      type: Number,
      required: [true, "balanceAfter is required"],
    },

    sourceInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"],
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "client_balance_transactions",
  }
);

clientBalanceTransactionSchema.index({ clientId: 1, createdAt: -1 });
clientBalanceTransactionSchema.index({ sourceInvoiceId: 1 });

const ClientBalanceTransaction = mongoose.model(
  "ClientBalanceTransaction",
  clientBalanceTransactionSchema
);

export default ClientBalanceTransaction;
