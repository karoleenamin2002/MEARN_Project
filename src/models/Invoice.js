import mongoose from "mongoose";

//Invoice Item Sub-Schema
const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Unit price cannot be negative"],
    },
    totalPrice: {
      type: Number,
      required: [true, "Total price is required"],
      min: [0, "Total price cannot be negative"],
    },
  },
  { _id: false }
);

// Invoice Schema 
const invoiceSchema = new mongoose.Schema(
  {
    invoiceType: {
      type: String,
      enum: {
        values: ["purchase", "sale", "purchase_return", "sales_return", "expense"],
        message:
          "invoiceType must be one of: purchase, sale, purchase_return, sales_return, expense",
      },
      required: [true, "Invoice type is required"],
    },

    invoiceNumber: {
      type: String,
      required: [true, "Invoice number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch ID is required"],
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },

    paymentMethod: {
      type: String,
      enum: {
        values: ["cash", "card", "wallet", "bank_transfer"],
        message:
          "paymentMethod must be one of: cash, card, wallet, bank_transfer",
      },
      required: [true, "Payment method is required"],
    },

    saleSource: {
      type: String,
      enum: {
        values: ["POS", "MANUAL"],
        message: "saleSource must be either POS or MANUAL",
      },
      default: null,
    },

    // Amounts (computed by Service, stored as-is) 
    baseAmount: {
      type: Number,
      required: [true, "Base amount is required"],
      min: [0, "Base amount cannot be negative"],
    },

    taxPercentage: {
      type: Number,
      default: 0,
      min: [0, "Tax percentage cannot be negative"],
      max: [100, "Tax percentage cannot exceed 100"],
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: [0, "Tax amount cannot be negative"],
    },

    finalAmount: {
      type: Number,
      required: [true, "Final amount is required"],
      min: [0, "Final amount cannot be negative"],
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },

    changeAmount: {
      type: Number,
      default: 0,
      min: [0, "Change amount cannot be negative"],
    },

    dueAmount: {
      type: Number,
      default: 0,
      min: [0, "Due amount cannot be negative"],
    },

    //  Items 
    items: {
      type: [invoiceItemSchema],
      validate: {
        validator: function (items) {
          if (this.invoiceType === "expense") return true;
          return Array.isArray(items) && items.length > 0;
        },
        message: "Invoice must contain at least one item",
      },
    },

    // Relations 
    relatedInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },

    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvoiceDocument",
      default: null,
    },

    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"],
    },

    isCancelled: {
  type: Boolean,
  default: false,
},

cancelledAt: {
  type: Date,
  default: null,
},

cancelledBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

cancellationReason: {
  type: String,
  trim: true,
  default: null,
},
       

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "invoices",
  }
);

//Indexes 
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ branchId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceType: 1, createdAt: -1 });
invoiceSchema.index({ clientId: 1 });
invoiceSchema.index({ relatedInvoiceId: 1 });
invoiceSchema.index({ isCancelled: 1 });
invoiceSchema.index({ createdBy: 1 });

//Virtual: paymentStatus 
invoiceSchema.virtual("paymentStatus").get(function () {
  if (this.dueAmount <= 0) return "paid";
  if (this.amountPaid > 0) return "partial";
  return "unpaid";
});

//  Model 
const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
