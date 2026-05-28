import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["client", "vendor"],
      required: [true, "Type is required"],
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);
// Create text index for search functionality
clientSchema.index({ name: "text", email: "text", phone: "text" });

const Client = mongoose.model("Client", clientSchema);

export default Client;
