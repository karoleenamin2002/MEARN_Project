import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getPlans,
  createPlan,
  createCheckout,
  getMySubscription,
  handleStripeWebhook,
} from "../controllers/subscriptionController.js";

const router = express.Router();


router.get("/subscription-plans", getPlans);


router.post(
  "/subscription-plans",
  protect,
  authorize("admin"),
  createPlan
);

router.post(
  "/subscriptions/create-checkout-session",
  protect,
  createCheckout
);


router.get("/subscriptions/me", protect, getMySubscription);

export default router;
