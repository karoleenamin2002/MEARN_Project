import Invoice from "../models/Invoice.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import Branch from "../models/Branch.js";
import Client from "../models/Client.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Return { start, end } representing midnight→midnight for a given date.
 * @param {Date} date  - The reference date (defaults to today UTC).
 * @param {number} offsetDays - Days to shift from the reference date.
 */
function dayRange(date = new Date(), offsetDays = 0) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + offsetDays);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

/**
 * Return start-of-day Date N days before the given anchor date (inclusive).
 * e.g. anchor = June 14, n = 30 → May 16 00:00 UTC
 */
function daysBeforeStart(anchor, n) {
  const d = new Date(anchor);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n + 1);
  return d;
}

const ALL_INVOICE_TYPES = [
  "purchase",
  "sale",
  "purchase_return",
  "sales_return",
  "expense",
];

/** Build a lookup from aggregate rows keyed by invoiceType. */
function totalsByType(rows) {
  const map = Object.fromEntries(ALL_INVOICE_TYPES.map((t) => [t, 0]));
  for (const row of rows) {
    if (row._id in map) map[row._id] = row.total;
  }
  return map;
}

/** Net sales: sale minus sales_return. */
function netSales(totals) {
  return totals.sale - totals.sales_return;
}

/** Net purchases: purchase minus purchase_return. */
function netPurchases(totals) {
  return totals.purchase - totals.purchase_return;
}

/** Net profit: net sales minus net purchases and expenses. */
function netProfit(totals) {
  return netSales(totals) - netPurchases(totals) - totals.expense;
}

// ─── KPI ────────────────────────────────────────────────────────────────────

/**
 * Aggregate net sales, net purchases, and net profit for a given date.
 * Trend % is computed vs the day before the selected date.
 * @param {Date} [anchorDate] - The date to aggregate (defaults to today).
 */
export async function getKpis(anchorDate = new Date()) {
  const selected = dayRange(anchorDate, 0);
  const previous = dayRange(anchorDate, -1);

  const [selectedResult, previousResult] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          isCancelled: false,
          invoiceType: { $in: ALL_INVOICE_TYPES },
          createdAt: { $gte: selected.start, $lt: selected.end },
        },
      },
      { $group: { _id: "$invoiceType", total: { $sum: "$finalAmount" } } },
    ]),

    Invoice.aggregate([
      {
        $match: {
          isCancelled: false,
          invoiceType: { $in: ALL_INVOICE_TYPES },
          createdAt: { $gte: previous.start, $lt: previous.end },
        },
      },
      { $group: { _id: "$invoiceType", total: { $sum: "$finalAmount" } } },
    ]),
  ]);

  const selectedTotals = totalsByType(selectedResult);
  const previousTotals = totalsByType(previousResult);

  const selSales = netSales(selectedTotals);
  const selPurchases = netPurchases(selectedTotals);
  const selProfit = netProfit(selectedTotals);

  const prevSales = netSales(previousTotals);
  const prevPurchases = netPurchases(previousTotals);
  const prevProfit = netProfit(previousTotals);

  const pctChange = (current, prev) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return (((current - prev) / prev) * 100).toFixed(1);
  };

  return {
    sales: {
      value: selSales,
      trend: pctChange(selSales, prevSales),
      trendUp: selSales >= prevSales,
    },
    purchases: {
      value: selPurchases,
      trend: pctChange(selPurchases, prevPurchases),
      trendUp: selPurchases >= prevPurchases,
    },
    profit: {
      value: selProfit,
      trend: pctChange(selProfit, prevProfit),
      trendUp: selProfit >= prevProfit,
    },
  };
}

// ─── Sales vs Purchases Chart ─────────────────────────────────────────────────

/**
 * Returns parallel arrays: labels (day strings), salesData, purchasesData.
 * The chart covers `days` days ending ON (and including) `anchorDate`.
 * @param {number} [days=30]
 * @param {Date}   [anchorDate]
 */
export async function getSalesPurchasesChart(days = 30, anchorDate = new Date()) {
  // End of the anchor day (exclusive upper bound)
  const rangeEnd = new Date(anchorDate);
  rangeEnd.setUTCHours(23, 59, 59, 999);

  const rangeStart = daysBeforeStart(anchorDate, days);

  const rows = await Invoice.aggregate([
    {
      $match: {
        isCancelled: false,
        invoiceType: { $in: ["sale", "purchase", "sales_return", "purchase_return"] },
        createdAt: { $gte: rangeStart, $lte: rangeEnd },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          type: "$invoiceType",
        },
        total: { $sum: "$finalAmount" },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  // Build dense day-by-day maps so days with no invoices appear as 0
  const salesMap = {};
  const purchasesMap = {};

  for (let i = 0; i < days; i++) {
    const d = new Date(rangeStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    salesMap[key] = 0;
    purchasesMap[key] = 0;
  }

  for (const row of rows) {
    const { date, type } = row._id;
    if (type === "sale") salesMap[date] = (salesMap[date] ?? 0) + row.total;
    else if (type === "sales_return") salesMap[date] = (salesMap[date] ?? 0) - row.total;
    else if (type === "purchase") purchasesMap[date] = (purchasesMap[date] ?? 0) + row.total;
    else if (type === "purchase_return") purchasesMap[date] = (purchasesMap[date] ?? 0) - row.total;
  }

  const labels = Object.keys(salesMap).sort();
  return {
    labels,
    salesData: labels.map((l) => salesMap[l]),
    purchasesData: labels.map((l) => purchasesMap[l]),
  };
}

// ─── Inventory Overview ──────────────────────────────────────────────────────

/**
 * Returns the top `limit` inventory items sorted by stock ratio (worst first).
 * Inventory is a current snapshot — date param is intentionally unused.
 */
export async function getInventoryOverview(limit = 10) {
  const branches = await Branch.find({}, "name products")
    .populate("products.product", "name")
    .lean();

  const items = [];

  for (const branch of branches) {
    for (const entry of branch.products) {
      if (!entry.product) continue;

      const qty = entry.quantity ?? 0;
      const min = entry.minimumStock ?? 0;

      let status;
      if (qty === 0) status = "Out of Stock";
      else if (min > 0 && qty <= min) status = "Low Stock";
      else status = "In Stock";

      items.push({
        productId: entry.product._id,
        name: entry.product.name,
        branchId: branch._id,
        branch: branch.name,
        stock: qty,
        minimumStock: min,
        status,
      });
    }
  }

  const statusOrder = { "Out of Stock": 0, "Low Stock": 1, "In Stock": 2 };
  items.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status];
    if (so !== 0) return so;
    const ratioA = a.minimumStock > 0 ? a.stock / a.minimumStock : Infinity;
    const ratioB = b.minimumStock > 0 ? b.stock / b.minimumStock : Infinity;
    return ratioA - ratioB;
  });

  return items.slice(0, limit);
}

// ─── Financial Summary ───────────────────────────────────────────────────────

/**
 * Returns cash in/out for the calendar month that contains `anchorDate`,
 * plus total client receivables and company payables (always current snapshot).
 * @param {Date} [anchorDate]
 */
export async function getFinancialSummary(anchorDate = new Date()) {
  const anchor = new Date(anchorDate);
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  // End of the anchor day (so cash in/out covers the full selected month up to end of that day)
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));

  const [paymentAgg, clientDebtAgg, companyDebtAgg] = await Promise.all([
    PaymentTransaction.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: "$direction", total: { $sum: "$amount" } } },
    ]),

    Invoice.aggregate([
      { $match: { isCancelled: false, dueAmount: { $gt: 0 }, invoiceType: "sale" } },
      { $group: { _id: null, total: { $sum: "$dueAmount" } } },
    ]),

    Client.aggregate([
      { $match: { currentBalance: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: "$currentBalance" } } },
    ]),
  ]);

  const extract = (arr, id) => arr.find((r) => r._id === id)?.total ?? 0;

  return {
    cashIn: extract(paymentAgg, "in"),
    cashOut: extract(paymentAgg, "out"),
    clientDebt: clientDebtAgg[0]?.total ?? 0,
    companyDebt: Math.abs(companyDebtAgg[0]?.total ?? 0),
  };
}

// ─── Recent Activity ─────────────────────────────────────────────────────────

/**
 * Returns the last `limit` events on or before the end of `anchorDate`.
 * @param {number} [limit=20]
 * @param {Date}   [anchorDate]
 */
export async function getRecentActivity(limit = 20, anchorDate = new Date()) {
  const cutoff = new Date(anchorDate);
  cutoff.setUTCHours(23, 59, 59, 999);

  const [recentInvoices, recentPayments] = await Promise.all([
    Invoice.find(
      { createdAt: { $lte: cutoff } },
      "invoiceNumber invoiceType finalAmount isCancelled cancelledAt createdAt clientId",
    )
      .populate("clientId", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .lean(),

    PaymentTransaction.find(
      { createdAt: { $lte: cutoff } },
      "invoiceId amount direction source createdAt",
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const events = [];

  for (const inv of recentInvoices) {
    if (inv.isCancelled) {
      events.push({
        type: "cancellation",
        icon: "cancel",
        title: `Invoice ${inv.invoiceNumber} Cancelled`,
        detail: inv.clientId?.name
          ? `Client: ${inv.clientId.name}`
          : `Type: ${inv.invoiceType}`,
        amount: inv.finalAmount,
        time: inv.cancelledAt ?? inv.updatedAt,
      });
    } else {
      const typeLabels = {
        sale: "Sale Invoice",
        purchase: "Purchase Invoice",
        sales_return: "Sales Return",
        purchase_return: "Purchase Return",
        expense: "Expense",
      };
      const typeLabel = typeLabels[inv.invoiceType] ?? inv.invoiceType;

      events.push({
        type: "invoice_created",
        icon: "description",
        title: `${typeLabel} ${inv.invoiceNumber} Created`,
        detail: inv.clientId?.name
          ? `Client: ${inv.clientId.name} • $${inv.finalAmount.toFixed(2)}`
          : `Amount: $${inv.finalAmount.toFixed(2)}`,
        amount: inv.finalAmount,
        time: inv.createdAt,
      });
    }
  }

  for (const pmt of recentPayments) {
    events.push({
      type: "payment",
      icon: "check_circle",
      title: "Payment Recorded",
      detail: `$${pmt.amount.toFixed(2)} • ${pmt.direction === "in" ? "Received" : "Refunded"}`,
      amount: pmt.amount,
      time: pmt.createdAt,
    });
  }

  events.sort((a, b) => new Date(b.time) - new Date(a.time));
  return events.slice(0, limit);
}
