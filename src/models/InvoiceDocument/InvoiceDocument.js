import mongoose from "mongoose";

const invoiceDocumentSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    fileName: { type: String, required: true },
    fileType: {
      type: String,
      enum: ["pdf", "jpg", "jpeg", "png"],
      required: true,
    },
    fileUrl: { type: String, required: true },
    ocrText: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("InvoiceDocument", invoiceDocumentSchema);
