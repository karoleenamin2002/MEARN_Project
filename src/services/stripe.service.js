import Stripe from "stripe";
import AppError from "../utils/appError.js";

// Initialise the Stripe client once — reuse across requests
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * createCheckoutSession
 * ──────────────────────
 * Creates a Stripe Checkout Session for a subscription plan.
 * The user is redirected to Stripe's hosted payment page.
 * On success Stripe redirects to SUCCESS_URL and fires the
 * checkout.session.completed webhook.
 */
export const createCheckoutSession = async ({
  stripePriceId,
  userEmail,
  userId,
  planId,
}) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe is not configured on this server.", 500);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],

    // Pre-fill customer email for smoother UX
    customer_email: userEmail,

    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],

    // Metadata flows through to the webhook so we can link back to our user
    subscription_data: {
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
      },
    },

    // Redirect URLs — set in environment for each environment (dev/prod)
    success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
  });

  return session;
};
/**
 * constructWebhookEvent
 * ──────────────────────
 * Verifies the Stripe webhook signature and returns the parsed event.
 * Must be called with the raw request body (before JSON.parse).
 * Requires express.raw() middleware on the webhook route.
 */
export const constructWebhookEvent = (rawBody, signature) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError("Stripe webhook secret is not configured.", 500);
  }

  try {
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    throw new AppError(`Webhook signature verification failed: ${err.message}`, 400);
  }
};

/**
 * retrieveSubscription
 * ─────────────────────
 * Fetches a Stripe Subscription object by ID.
 * Used in webhook handling to get up-to-date period dates and status.
 */
export const retrieveSubscription = async (stripeSubscriptionId) => {
  return stripe.subscriptions.retrieve(stripeSubscriptionId);
};

export default stripe;
