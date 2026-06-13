import * as DashboardService from "../services/dashboard.service.js";

// ─── Unified dashboard endpoint ──────────────────────────────────────────────

/**
 * GET /api/dashboard
 * Returns all dashboard data in one round-trip.
 * All sections run in parallel via Promise.allSettled so a single failure
 * in one section doesn't take down the whole response.
 */
export async function getDashboardData(req, res) {
  const days = parseInt(req.query.days ?? "30", 10) || 30;
  const activityLimit = parseInt(req.query.activityLimit ?? "10", 10) || 10;
  const inventoryLimit = parseInt(req.query.inventoryLimit ?? "10", 10) || 10;

  const [kpisResult, chartResult, inventoryResult, financialsResult, activityResult] =
    await Promise.allSettled([
      DashboardService.getKpis(),
      DashboardService.getSalesPurchasesChart(days),
      DashboardService.getInventoryOverview(inventoryLimit),
      DashboardService.getFinancialSummary(),
      DashboardService.getRecentActivity(activityLimit),
    ]);

  const unwrap = (result, fallback) =>
    result.status === "fulfilled" ? result.value : fallback;

  return res.status(200).json({
    success: true,
    data: {
      kpis: unwrap(kpisResult, null),
      chart: unwrap(chartResult, null),
      inventory: unwrap(inventoryResult, []),
      financials: unwrap(financialsResult, null),
      activities: unwrap(activityResult, []),
    },
    // Surface any per-section errors so the client can show partial UI
    errors: {
      kpis: kpisResult.status === "rejected" ? kpisResult.reason?.message : null,
      chart: chartResult.status === "rejected" ? chartResult.reason?.message : null,
      inventory: inventoryResult.status === "rejected" ? inventoryResult.reason?.message : null,
      financials: financialsResult.status === "rejected" ? financialsResult.reason?.message : null,
      activities: activityResult.status === "rejected" ? activityResult.reason?.message : null,
    },
  });
}

// ─── Granular endpoints (for partial refresh / independent polling) ───────────

/** GET /api/dashboard/kpis */
export async function getKpis(req, res) {
  const data = await DashboardService.getKpis();
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/chart?days=30 */
export async function getChart(req, res) {
  const days = parseInt(req.query.days ?? "30", 10) || 30;
  const data = await DashboardService.getSalesPurchasesChart(days);
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/inventory?limit=10 */
export async function getInventory(req, res) {
  const limit = parseInt(req.query.limit ?? "10", 10) || 10;
  const data = await DashboardService.getInventoryOverview(limit);
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/financials */
export async function getFinancials(req, res) {
  const data = await DashboardService.getFinancialSummary();
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/activity?limit=10 */
export async function getActivity(req, res) {
  const limit = parseInt(req.query.limit ?? "10", 10) || 10;
  const data = await DashboardService.getRecentActivity(limit);
  res.status(200).json({ success: true, data });
}
