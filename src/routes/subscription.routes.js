import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getPlans,
  createPlan,
  createCheckout,
  getMySubscription,
  getAllSubscriptions,
  getUserSubscriptions,
  updateUserSubscription,
  // cancelUserSubscription,
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

router.get(
  "/admin/subscriptions",
  protect,
  authorize("admin"),
  getAllSubscriptions
);

router.get(
  "/admin/users/:userId/subscriptions",
  protect,
  authorize("admin"),
  getUserSubscriptions
);

router.patch(
  "/admin/subscriptions/:id",
  protect,
  authorize("admin"),
  updateUserSubscription
);

// router.patch(
//   "/admin/subscriptions/:id/cancel",
//   protect,
//   authorize("admin"),
//   cancelUserSubscription
// );

export default router;
