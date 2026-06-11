import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    // Display name shown to users ( "Starter", "Pro", "Enterprise")
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      unique: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    price: {
      type: Number,
      required: [true, "Plan price is required"],
      min: [0, "Price cannot be negative"],
    },

    aiCreditLimit: {
      type: Number,
      required: [true, "AI credit limit is required"],
      min: [0, "Credit limit cannot be negative"],
    },

   
    stripePriceId: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

export default SubscriptionPlan;
