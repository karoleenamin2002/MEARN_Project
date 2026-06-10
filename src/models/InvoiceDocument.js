import mongoose from "mongoose";

const invoiceDocumentSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    fileType: {
      type: String,
      enum: ["pdf", "jpg", "jpeg", "png"],
      required: true,
    },

    fileUrl: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    ocrText: {
      type: String,
      default: "",
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    notes: {
      type: String,
      trim: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

invoiceDocumentSchema.index({ invoiceId: 1 });
invoiceDocumentSchema.index({ uploadedBy: 1 });
invoiceDocumentSchema.index({ createdAt: -1 });

export default mongoose.model("InvoiceDocument", invoiceDocumentSchema);