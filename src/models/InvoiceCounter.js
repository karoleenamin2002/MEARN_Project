import mongoose from "mongoose";

const invoiceCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    collection : "invoicecounters",
    timestamps : false,
    versionKey : false,
  }
);

const InvoiceCounter = mongoose.model("InvoiceCounter", invoiceCounterSchema);

export default InvoiceCounter;
