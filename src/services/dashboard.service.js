import Invoice from "../models/Invoice.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import Branch from "../models/Branch.js";
import Client from "../models/Client.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Return { start, end } representing midnight→midnight for a given UTC day offset (0 = today). */
function dayRange(offsetDays = 0) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + offsetDays);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

/** Return start-of-day Date N days ago (inclusive window start for 30-day chart). */
function daysAgoStart(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n + 1); // e.g. n=30 → 30 days including today
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
  //the row is an object contains (the total of specific invoice type amount and the id with is (the invice type itself))
  const map = Object.fromEntries(
    ALL_INVOICE_TYPES.map((t) => [t, 0]),
  );
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
 * Aggregate today's net sales, net purchases, and net profit.
 * Sales = sale − sales_return; purchases = purchase − purchase_return;
 * profit = net sales − net purchases − expenses. Only non-cancelled invoices count.
 */
export async function getKpis() {
  const { start, end } = dayRange(0);
  const yesterday = dayRange(-1);

  const [todayResult, yesterdayResult] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          isCancelled: false,
          invoiceType: { $in: ALL_INVOICE_TYPES },
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: "$invoiceType",
          total: { $sum: "$finalAmount" },
        },
      },
    ]),

    // Yesterday – needed to compute trend %
    Invoice.aggregate([
      {
        $match: {
          isCancelled: false,
          invoiceType: { $in: ALL_INVOICE_TYPES },
          createdAt: { $gte: yesterday.start, $lt: yesterday.end },
        },
      },
      {
        $group: {
          _id: "$invoiceType",
          total: { $sum: "$finalAmount" },
        },
      },
    ]),
  ]);

  const todayTotals = totalsByType(todayResult);
  const yesterdayTotals = totalsByType(yesterdayResult);

  const todaySales = netSales(todayTotals);
  const todayPurchases = netPurchases(todayTotals);
  const todayProfit = netProfit(todayTotals);

  const yestSales = netSales(yesterdayTotals);
  const yestPurchases = netPurchases(yesterdayTotals);
  const yestProfit = netProfit(yesterdayTotals);

  const pctChange = (today, yesterday) => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return (((today - yesterday) / yesterday) * 100).toFixed(1);
  };

  return {
    sales: {
      value: todaySales,
      trend: pctChange(todaySales, yestSales),
      trendUp: todaySales >= yestSales,
    },
    purchases: {
      value: todayPurchases,
      trend: pctChange(todayPurchases, yestPurchases),
      trendUp: todayPurchases >= yestPurchases,
    },
    profit: {
      value: todayProfit,
      trend: pctChange(todayProfit, yestProfit),
      trendUp: todayProfit >= yestProfit,
    },
  };
}

// ─── Sales vs Purchases Chart (30 days) ─────────────────────────────────────

/**
 * Returns parallel arrays: labels (day strings), salesData, purchasesData.
 * Sales per day = sale − sales_return; purchases per day = purchase − purchase_return.
 * One entry per day for the last `days` days (default 30).
 */
//Done understood
export async function getSalesPurchasesChart(days = 30) {
  const rangeStart = daysAgoStart(days);
  const now = new Date();

  const rows = await Invoice.aggregate([
    {
      $match: {
        isCancelled: false,
        invoiceType: {
          $in: ["sale", "purchase", "sales_return", "purchase_return"],
        },
        createdAt: { $gte: rangeStart, $lt: now },
      },
    },
    {
      $group: {
        _id: {
          // Group by UTC date string "YYYY-MM-DD" and invoice type
          /** Notes For Me Abanoub
           * $dateToString takes an object with two main keys:
           * format → a string pattern that defines how the date should look when converted to text.
           * Example: "%Y-%m-%d" → "2026-06-12"
           * Example: "%Y-%m" → "2026-06"
           * date → the actual field (or expression) containing the Date value you want to format.
           * Example: date: "$createdAt" → uses the createdAt field from each document.
           */
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          type: "$invoiceType",
        },
        total: { $sum: "$finalAmount" },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  // Build a dense day-by-day map so days with no invoices appear as 0
  const salesMap = {};
  const purchasesMap = {};

  //this loop output two objects (each one its keys are the dates (30 days) and the values are 0)
  for (let i = 0; i < days; i++) {
    const d = new Date(rangeStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    salesMap[key] = 0;
    purchasesMap[key] = 0;
  }

  //the rows ordered by the date
  for (const row of rows) {
    const { date, type } = row._id;
    if (type === "sale") salesMap[date] += row.total;
    else if (type === "sales_return") salesMap[date] -= row.total;
    else if (type === "purchase") purchasesMap[date] += row.total;
    else if (type === "purchase_return") purchasesMap[date] -= row.total;
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
 * Each item: { name, branch, stock, minimumStock, status }
 */
//Done Understood
export async function getInventoryOverview(limit = 10) {
  const branches = await Branch.find({}, "name products")
    .populate("products.product", "name")
    .lean();

  const items = [];

  for (const branch of branches) {
    for (const entry of branch.products) {
      if (!entry.product) continue; // guard against orphaned refs

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

  // Sort: out-of-stock first, then low-stock, then in-stock; within each group worst ratio first
  const statusOrder = { "Out of Stock": 0, "Low Stock": 1, "In Stock": 2 };
  items.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status];
    if (so !== 0) return so;
    // Lower ratio = worse
    //Infinity is a special numeric value built into JavaScript.
    // It represents a number larger than any other number.// Notes For Me Abanoub
    const ratioA = a.minimumStock > 0 ? a.stock / a.minimumStock : Infinity;
    const ratioB = b.minimumStock > 0 ? b.stock / b.minimumStock : Infinity;
    return ratioA - ratioB;
  });

  return items.slice(0, limit);
}

// ─── Financial Summary ───────────────────────────────────────────────────────

/**
 * Returns cash in/out for the current month from PaymentTransaction,
 * plus total client receivables (Invoice.dueAmount) and company payables (Client.currentBalance < 0).
 */
//Done understood
export async function getFinancialSummary() {
  const now = new Date();
  //UTC stands for Coordinated Universal Time. It’s the global time standard that all computers,
  //servers, and networks use to stay in sync. Think of it as the “baseline clock” for the world.
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const [paymentAgg, clientDebtAgg, companyDebtAgg] = await Promise.all([
    // Cash in / out this month via PaymentTransaction
    PaymentTransaction.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: "$direction", //groub by direction [in,out]
          total: { $sum: "$amount" },
        },
      },
    ]),

    // Client receivables: sum of dueAmount on active (non-cancelled) sale invoices
    Invoice.aggregate([
      {
        $match: {
          isCancelled: false,
          dueAmount: { $gt: 0 },
          invoiceType: "sale",
        },
      },
      { $group: { _id: null, total: { $sum: "$dueAmount" } } },
    ]),

    // Company payables: clients whose currentBalance is negative (company owes them)
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
/**Done understood */
/**
 * Returns the last `limit` significant events: invoice creations, payments, cancellations.
 * Merges and sorts two collections in JS (avoids $unionWith compatibility issues).
 */
export async function getRecentActivity(limit = 20) {
  const [recentInvoices, recentPayments] = await Promise.all([
    Invoice.find(
      {},
      "invoiceNumber invoiceType finalAmount isCancelled cancelledAt createdAt clientId",
    )
      .populate("clientId", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .lean(),

    PaymentTransaction.find({}, "invoiceId amount direction source createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(), //Returns plain JS Objects not Mongoose wrapped objects (which has getters and setters of mongoose)
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

  // Sort all merged events newest-first and take top N
  events.sort((a, b) => new Date(b.time) - new Date(a.time));
  return events.slice(0, limit);
}
