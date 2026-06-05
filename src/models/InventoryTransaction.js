import mongoose from "mongoose";

const inventoryTransactionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    branchName: {
      type: String,
      required: true,
      trim: true,
    },

    transactionType: {
      type: String,
      enum: [
        "purchase",
        "sale",
        "purchase_return",
        "sales_return",
        "adjustment",
        "invoice_cancel",
      ],
      required: true,
    },

    quantity: { type: Number, required: true },
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },

    sourceInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

inventoryTransactionSchema.index({
  branchId: 1,
  createdAt: -1,
});

inventoryTransactionSchema.index({
  productId: 1,
  branchId: 1,
});

inventoryTransactionSchema.index({
  sourceInvoiceId: 1,
});

export default mongoose.model(
  "InventoryTransaction",
  inventoryTransactionSchema,
);
