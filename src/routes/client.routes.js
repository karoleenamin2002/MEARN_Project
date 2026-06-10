import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from "../controllers/clientController.js";
import { getClientBalance } from "../controllers/paymentController.js";
import { getClientBalanceRules } from "../validations/payment.validation.js";

const router = Router();

router.use(protect);

router.get("/", authorize("admin", "employee"), getClients);
router.get("/:id", authorize("admin", "employee"), getClientById);
router.post("/", authorize("admin"), createClient);
router.put("/:id", authorize("admin"), updateClient);
router.delete("/:id", authorize("admin"), deleteClient);

// Payments & Balances
router.get(
  "/:id/balance",
  authorize("admin", "employee"),
  getClientBalanceRules,
  getClientBalance
);

export default router;
