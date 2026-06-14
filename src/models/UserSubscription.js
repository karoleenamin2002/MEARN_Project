import mongoose from "mongoose";
const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },

    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },

    // Stripe Customer ID for creating future sessions
    stripeCustomerId: {
      type: String,
      required: true,
    },

    /**
     * Subscription lifecycle status (mirrors Stripe statuses):
     * - active:    Paid and in good standing
     * - trialing:  In a free trial period
     * - past_due:  Payment failed; Stripe is retrying
     * - cancelled: User cancelled; access ends at periodEnd
     * - incomplete: Initial payment not yet confirmed
     */
    status: {
      type: String,
      enum: ["active", "trialing", "past_due", "cancelled", "incomplete"],
      default: "incomplete",
    },

   
    creditsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },

    creditLimit: {
      type: Number,
      required: true,
      min: 0,
    },

    
    currentPeriodStart: {
      type: Date,
      default: null,
    },

   
    currentPeriodEnd: {
      type: Date,
      default: null,
    },

    
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Virtual: credits still available this cycle.
 * Returns 0 if the user has exceeded their limit.
 */
userSubscriptionSchema.virtual("creditsRemaining").get(function () {
  return Math.max(0, this.creditLimit - this.creditsUsed);
});


userSubscriptionSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["active", "trialing"] } },
  }
);

const UserSubscription = mongoose.model("UserSubscription", userSubscriptionSchema);

export default UserSubscription;
