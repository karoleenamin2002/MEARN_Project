import mongoose from "mongoose";

const inventoryCountItem = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    expectedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    countedQuantity: {
      type: Number,
      default: null,
      min: 0,
    },
    variance: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const inventoryCount = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch is required"],
    },
    status: {
      type: String,
      enum: ["initiated", "completed", "cancelled"],
      default: "initiated",
    },
    countedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Counted by user is required"],
    },
    items: [inventoryCountItem],
    notes: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

inventoryCount.pre("save", function (next) {
  if (this.countedQuantity !== undefined) {
    this.variance = this.countedQuantity - this.expectedQuantity;
  }
  next();
});

export default mongoose.model("InventoryCount", inventoryCount);
