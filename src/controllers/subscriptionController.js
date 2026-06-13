import SubscriptionPlan from "../models/SubscriptionPlan.js";
import UserSubscription from "../models/UserSubscription.js";
import AppError from "../utils/appError.js";
import { catchError } from "../utils/catchError.js";
import {
  createCheckoutSession,
  constructWebhookEvent,
  retrieveSubscription,
} from "../services/stripe.service.js";
import {
  getUserActiveSubscription,
  resetCycleCredits,
  updateSubscriptionStatus,
} from "../services/subscription.service.js";

export const getPlans = catchError(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({
    price: 1,
  });

  res.status(200).json({
    success: true,
    count: plans.length,
    data: plans,
  });
});

export const createPlan = catchError(async (req, res) => {
  const { name, description, price, aiCreditLimit, stripePriceId, isActive } =
    req.body;

  if (!name || price === undefined || aiCreditLimit === undefined) {
    throw new AppError("name, price, and aiCreditLimit are required.", 400);
  }

  const plan = await SubscriptionPlan.create({
    name,
    description,
    price,
    aiCreditLimit,
    stripePriceId: stripePriceId || null,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    success: true,
    message: "Subscription plan created successfully.",
    data: plan,
  });
});

// POST /api/subscriptions/create-checkout-session

export const createCheckout = catchError(async (req, res) => {
  const { planId } = req.body;

  if (!planId) {
    throw new AppError("planId is required.", 400);
  }

  // Verify the plan exists and is active
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || !plan.isActive) {
    throw new AppError(
      "Subscription plan not found or is no longer available.",
      404,
    );
  }

  if (!plan.stripePriceId) {
    throw new AppError(
      "This plan is not yet configured for payments. Please contact support.",
      400,
    );
  }

  const existing = await getUserActiveSubscription(req.user._id);
  if (existing) {
    throw new AppError(
      "You already have an active subscription. Cancel it before subscribing to a new plan.",
      409,
    );
  }

  const session = await createCheckoutSession({
    stripePriceId: plan.stripePriceId,
    userEmail: req.user.email,
    userId: req.user._id,
    planId: plan._id,
  });

  res.status(200).json({
    success: true,
    checkoutUrl: session.url,
    sessionId: session.id,
  });
});

// GET /api/subscriptions/me

export const getMySubscription = catchError(async (req, res) => {
  const subscription = await getUserActiveSubscription(req.user._id);

  if (!subscription) {
    return res.status(200).json({
      success: true,
      data: null,
      message: "No active subscription found.",
    });
  }

  const creditsRemaining = Math.max(
    0,
    subscription.creditLimit - subscription.creditsUsed,
  );

  res.status(200).json({
    success: true,
    data: {
      ...subscription.toObject(),
      creditsRemaining,
    },
  });
});

/**
 * POST /api/stripe/webhook
 * Handles Stripe lifecycle events.
 *
 * Supported events:
 *   - checkout.session.completed   → Create UserSubscription
 *   - invoice.payment_succeeded    → Reset cycle credits
 *   - customer.subscription.updated → Sync status changes
 *   - customer.subscription.deleted → Mark as cancelled
 *
 * IMPORTANT: This route must receive the RAW body (not parsed JSON).
 * The express.raw() middleware is applied at the route level (see routes file).
 */
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  // console.log("WEBHOOK BODY IS BUFFER:", Buffer.isBuffer(req.body));
  // console.log(
  //   "WEBHOOK SECRET:",
  //   process.env.STRIPE_WEBHOOK_SECRET?.slice(0, 15),
  // );
  let event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error(
      "[Stripe Webhook] Signature verification failed:",
      err.message,
    );
    return res.status(400).json({ success: false, message: err.message });
  }

  try {
    switch (event.type) {
      // New subscription created via checkout
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode !== "subscription") break;

        const stripeSubscriptionId = session.subscription;
        const stripeCustomerId = session.customer;

        const stripeSub = await retrieveSubscription(stripeSubscriptionId);

        const { userId, planId } = stripeSub.metadata;

        const periodStart =
          stripeSub.current_period_start ||
          stripeSub.items?.data?.[0]?.current_period_start;

        const periodEnd =
          stripeSub.current_period_end ||
          stripeSub.items?.data?.[0]?.current_period_end;

        if (!userId || !planId) {
          console.error(
            "[Stripe Webhook] Missing metadata on subscription:",
            stripeSubscriptionId,
          );
          break;
        }

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
          console.error("[Stripe Webhook] Plan not found:", planId);
          break;
        }

        await UserSubscription.create({
          userId,
          planId,
          stripeSubscriptionId,
          stripeCustomerId,
          status: stripeSub.status,
          creditLimit: plan.aiCreditLimit,
          creditsUsed: 0,
          currentPeriodStart: periodStart
            ? new Date(periodStart * 1000)
            : new Date(),
          currentPeriodEnd: periodEnd
            ? new Date(periodEnd * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        console.log(`[Stripe Webhook] Subscription created for user ${userId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        if (!invoice.subscription) break;

        const stripeSub = await retrieveSubscription(invoice.subscription);

        const periodStart =
          stripeSub.current_period_start ||
          stripeSub.items?.data?.[0]?.current_period_start;

        const periodEnd =
          stripeSub.current_period_end ||
          stripeSub.items?.data?.[0]?.current_period_end;

        await resetCycleCredits(
          invoice.subscription,
          periodStart ? new Date(periodStart * 1000) : new Date(),
          periodEnd
            ? new Date(periodEnd * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        );

        console.log(
          `[Stripe Webhook] Credits reset for subscription ${invoice.subscription}`,
        );
        break;
      }

      //  Subscription status changed
      case "customer.subscription.updated": {
        const stripeSub = event.data.object;

        await updateSubscriptionStatus(stripeSub.id, stripeSub.status);

        console.log(
          `[Stripe Webhook] Subscription ${stripeSub.id} status → ${stripeSub.status}`,
        );
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object;

        await updateSubscriptionStatus(stripeSub.id, "cancelled");

        console.log(`[Stripe Webhook] Subscription ${stripeSub.id} cancelled`);
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);

    res.status(200).json({ received: true, warning: "Internal handler error" });
  }
};

export const getAllSubscriptions = catchError(async (req, res) => {
  const subscriptions = await UserSubscription.find()
    .populate("userId", "name email role")
    .populate("planId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: subscriptions.length,
    data: subscriptions,
  });
});

export const getUserSubscriptions = catchError(async (req, res) => {
  const { userId } = req.params;

  const subscriptions = await UserSubscription.find({ userId })
    .populate("planId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: subscriptions.length,
    data: subscriptions,
  });
});

export const updateUserSubscription = catchError(async (req, res) => {
  const { id } = req.params;
  const { creditLimit, status } = req.body;

  const updateData = {};

  if (creditLimit !== undefined) {
    updateData.creditLimit = creditLimit;
  }

  if (status !== undefined) {
    updateData.status = status;

    if (status === "cancelled") {
      updateData.cancelledAt = new Date();
    }
  }

  const subscription = await UserSubscription.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate("userId", "name email role")
    .populate("planId");

  if (!subscription) {
    throw new AppError("Subscription not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Subscription updated successfully.",
    data: subscription,
  });
});

// export const cancelUserSubscription = catchError(async (req, res) => {
//   const { id } = req.params;

//   const subscription = await UserSubscription.findByIdAndUpdate(
//     id,
//     {
//       status: "cancelled",
//       cancelledAt: new Date(),
//     },
//     { new: true, runValidators: true }
//   )
//     .populate("userId", "name email role")
//     .populate("planId");

//   if (!subscription) {
//     throw new AppError("Subscription not found.", 404);
//   }

//   res.status(200).json({
//     success: true,
//     message: "Subscription cancelled successfully.",
//     data: subscription,
//   });
// });