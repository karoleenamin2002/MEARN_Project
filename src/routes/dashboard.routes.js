import { Router } from "express";
import {
  getDashboardData,
  getKpis,
  getChart,
  getInventory,
  getFinancials,
  getActivity,
} from "../controllers/dashboard.controller.js";

const router = Router();

// ─── Unified ─────────────────────────────────────────────────────────────────
// GET /api/dashboard
// Optional query params: days=30, activityLimit=10, inventoryLimit=10
router.get("/", getDashboardData);

// ─── Granular (for partial refresh / independent component polling) ───────────
// GET /api/dashboard/kpis
router.get("/kpis", getKpis);

// GET /api/dashboard/chart?days=30
router.get("/chart", getChart);

// GET /api/dashboard/inventory?limit=10
router.get("/inventory", getInventory);

// GET /api/dashboard/financials
router.get("/financials", getFinancials);

// GET /api/dashboard/activity?limit=10
router.get("/activity", getActivity);

export default router;
