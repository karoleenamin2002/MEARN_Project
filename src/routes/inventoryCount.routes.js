import { Router } from "express";
import {
  initiateCount,
  getCounts,
  getCount,
  updateCount,
  completeCount,
  cancelCount,
  getBranchCounts,
} from "../controllers/inventoryCountController.js";
import { protect } from "../middleware/auth.js";
const router = Router();

router.use(protect);

router.post("/", initiateCount);
router.get("/", getCounts);
router.get("/branch/:id", getBranchCounts);

router.get("/:id", getCount);
router.patch("/:id/update", updateCount);
router.patch("/:id/complete", completeCount);
router.delete("/:id/", cancelCount);

export default router;
