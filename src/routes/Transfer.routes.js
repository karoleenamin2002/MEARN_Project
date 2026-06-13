import { Router } from "express";
import {
  createTransfer,
  getTransfers,
  getTransferById,
} from "../controllers/Transfercontroller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.post("/", createTransfer);
router.get("/", getTransfers);
router.get("/:id", getTransferById);

export default router;
