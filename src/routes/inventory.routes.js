import { Router } from "express";
import {
  getInventoryTransactions,
  getProductTransactions,
  getBranchTransactions,
  getProductTransactionsInBranch,
  adjustInventoryController,
} from "../controllers/inventoryController.js";
import { protect, authorize } from "../middleware/auth.js";
import { adjustmentRules } from "../validations/inventoryAdjustment.validation.js";

const router = Router();

router.use(protect);
router.get("/", getInventoryTransactions);
router.get("/product/:id", getProductTransactions);
router.get("/branch/:id", getBranchTransactions);
router.get("/:branchId/:productId", getProductTransactionsInBranch);
router.post(
  "/adjust",
  authorize("admin", "employee"),
  adjustmentRules,
  adjustInventoryController,
);

export default router;
