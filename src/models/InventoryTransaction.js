import mongoose from "mongoose";

const inventoryTransactionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
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
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model(
  "InventoryTransaction",
  inventoryTransactionSchema,
);
