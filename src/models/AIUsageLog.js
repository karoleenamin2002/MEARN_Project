import mongoose from "mongoose";

/**
 * AIUsageLog — immutable audit record created after every AI API call.
 * Used for credit deduction history, billing transparency, and debugging.
 * One document per individual AI request.
 */
const aiUsageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSubscription",
      required: true,
    },
    /**
     *chat
     *invoice_extraction
     *invoice_analysis
     *report_generation
      *rag_search
       */
    requestType: {
      type: String,
      required: [true, "Request type is required"],
      trim: true,
    },

    
    inputTokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    outputTokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalTokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    creditsUsed: {
      type: Number,
      required: true,
      min: 0,
    },

    creditsAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    /**
     * Outcome of the AI call:
     * - success:  Completed normally
     * - failed:   API error or timeout
     * - rejected: Blocked before calling API (e.g. insufficient credits)
     */
    status: {
      type: String,
      enum: ["success", "failed", "rejected"],
      default: "success",
    },

    
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Fast lookup for per-user usage history
aiUsageLogSchema.index({ userId: 1, createdAt: -1 });

const AIUsageLog = mongoose.model("AIUsageLog", aiUsageLogSchema);

export default AIUsageLog;
