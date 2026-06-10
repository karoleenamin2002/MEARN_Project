import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as paymentController from "../controllers/paymentController.js";
import {
  createPaymentRules,
  getPaymentsRules,
} from "../validations/payment.validation.js";

const router = Router();

router.use(protect);

router.post(
  "/",
  authorize("admin", "employee"),
  createPaymentRules,
  paymentController.createPayment
);

router.get(
  "/",
  authorize("admin", "employee"),
  getPaymentsRules,
  paymentController.getPayments
);

export default router;
