import { Router } from "express";
import {
  getInventoryTransactions,
  getProductTransactions,
  getBranchTransactions,
  getProductTransactionsInBranch,
} from "../controllers/inventoryController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// router.use(protect);
router.get("/", getInventoryTransactions);
router.get("/product/:id", getProductTransactions);
router.get("/branch/:id", getBranchTransactions);
router.get("/:branchId/:productId", getProductTransactionsInBranch);
export default router;
