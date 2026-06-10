import { Router } from "express";
import {
  getTransactions,
  getProductTransactions,
  adjustInventoryController,
} from "../controllers/inventoryController.js";
import { protect, authorize } from "../middleware/auth.js";
import { adjustmentRules } from "../validations/inventoryAdjustment.validation.js";

const router = Router();

router.use(protect);

router.post(
  "/adjust",
  authorize("admin", "employee"),
  adjustmentRules,
  adjustInventoryController,
);

router.get("/", getTransactions);
router.get("/product/:productId", getProductTransactions);

export default router;
