import * as DashboardService from "../services/dashboard.service.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parse an ISO date string (YYYY-MM-DD) from the query param `date`.
 * Falls back to today (UTC midnight) if the param is absent or invalid.
 */
function parseDateParam(dateStr) {
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

// ─── Unified dashboard endpoint ──────────────────────────────────────────────

/**
 * GET /api/dashboard
 * Optional query params:
 *   date=YYYY-MM-DD   → anchor date for KPIs, chart, financials, activity (default: today)
 *   days=30           → chart window in days ending on `date`
 *   activityLimit=10
 *   inventoryLimit=10
 */
export async function getDashboardData(req, res) {
  const anchorDate = parseDateParam(req.query.date);
  const days = parseInt(req.query.days ?? "30", 10) || 30;
  const activityLimit = parseInt(req.query.activityLimit ?? "10", 10) || 10;
  const inventoryLimit = parseInt(req.query.inventoryLimit ?? "10", 10) || 10;

  const [kpisResult, chartResult, inventoryResult, financialsResult, activityResult] =
    await Promise.allSettled([
      DashboardService.getKpis(anchorDate),
      DashboardService.getSalesPurchasesChart(days, anchorDate),
      DashboardService.getInventoryOverview(inventoryLimit),
      DashboardService.getFinancialSummary(anchorDate),
      DashboardService.getRecentActivity(activityLimit, anchorDate),
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
    errors: {
      kpis: kpisResult.status === "rejected" ? kpisResult.reason?.message : null,
      chart: chartResult.status === "rejected" ? chartResult.reason?.message : null,
      inventory: inventoryResult.status === "rejected" ? inventoryResult.reason?.message : null,
      financials: financialsResult.status === "rejected" ? financialsResult.reason?.message : null,
      activities: activityResult.status === "rejected" ? activityResult.reason?.message : null,
    },
  });
}

// ─── Granular endpoints ───────────────────────────────────────────────────────

/** GET /api/dashboard/kpis?date=YYYY-MM-DD */
export async function getKpis(req, res) {
  const anchorDate = parseDateParam(req.query.date);
  const data = await DashboardService.getKpis(anchorDate);
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/chart?days=30&date=YYYY-MM-DD */
export async function getChart(req, res) {
  const days = parseInt(req.query.days ?? "30", 10) || 30;
  const anchorDate = parseDateParam(req.query.date);
  const data = await DashboardService.getSalesPurchasesChart(days, anchorDate);
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/inventory?limit=10 */
export async function getInventory(req, res) {
  const limit = parseInt(req.query.limit ?? "10", 10) || 10;
  const data = await DashboardService.getInventoryOverview(limit);
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/financials?date=YYYY-MM-DD */
export async function getFinancials(req, res) {
  const anchorDate = parseDateParam(req.query.date);
  const data = await DashboardService.getFinancialSummary(anchorDate);
  res.status(200).json({ success: true, data });
}

/** GET /api/dashboard/activity?limit=10&date=YYYY-MM-DD */
export async function getActivity(req, res) {
  const limit = parseInt(req.query.limit ?? "10", 10) || 10;
  const anchorDate = parseDateParam(req.query.date);
  const data = await DashboardService.getRecentActivity(limit, anchorDate);
  res.status(200).json({ success: true, data });
}
