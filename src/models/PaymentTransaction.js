import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: [true, "invoiceId is required"],
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "branchId is required"],
    },

    amount: {
      type: Number,
      required: [true, "amount is required"],
      min: [0.01, "amount must be greater than zero"],
    },

    paymentMethod: {
      type: String,
      enum: {
        values: ["cash", "card", "wallet", "bank_transfer"],
        message:
          "paymentMethod must be one of: cash, card, wallet, bank_transfer",
      },
      required: [true, "paymentMethod is required"],
    },

    // Source of this payment record
    source: {
      type: String,
      enum: {
        values: ["invoice_creation", "manual_payment", "cancellation_reversal"],
        message:
          "source must be one of: invoice_creation, manual_payment,cancellation_reversal",
      },
      required: [true, "source is required"],
    },

    direction: {
      type: String,
      enum: {
        values: ["in", "out"],
        message: "direction must be one of: in, out",
      },
      default: "in",
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "paidBy is required"],
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "payment_transactions",
  },
);

paymentTransactionSchema.index({ invoiceId: 1, createdAt: -1 });
paymentTransactionSchema.index({ clientId: 1, createdAt: -1 });
paymentTransactionSchema.index({ branchId: 1, createdAt: -1 });

const PaymentTransaction = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema,
);

export default PaymentTransaction;
