import { Router } from "express";
import type { Pool } from "pg";
import { requireAuth, allowRoles } from "../security/sessions.js";

export function financialIntelligenceRoutes(pool: Pool) {
  const router = Router();
  router.use(requireAuth(pool), allowRoles("owner", "manager"));

  router.get("/overview", async (req, res, next) => {
    const months = Math.min(12, Math.max(3, Number(req.query.months ?? 6)));
    if (!Number.isInteger(months)) return res.status(400).json({ error: "Months must be an integer from 3 to 12." });
    try {
      const monthly = await pool.query(
        `SELECT date_trunc('month', e.entry_date)::date::text AS month,
          COALESCE(sum(CASE WHEN a.account_type='revenue' THEN l.credit-l.debit ELSE 0 END) FILTER (WHERE a.account_type='revenue'),0)::text AS revenue,
          COALESCE(sum(l.debit-l.credit) FILTER (WHERE a.account_type='expense'),0)::text AS expenses,
          COALESCE(sum(l.debit-l.credit) FILTER (WHERE a.account_code='5000'),0)::text AS cost_of_goods_sold,
          COALESCE(sum(l.debit-l.credit) FILTER (WHERE a.account_code IN ('1000','1010','1020','1030')),0)::text AS net_cash_movement
        FROM journal_entries e
        JOIN journal_lines l ON l.journal_entry_id=e.id
        JOIN chart_of_accounts a ON a.id=l.account_id
        WHERE e.status='posted'
          AND e.entry_date >= (date_trunc('month', current_date) - ($1::int - 1) * interval '1 month')::date
          AND e.entry_date < (date_trunc('month', current_date) + interval '1 month')::date
        GROUP BY date_trunc('month', e.entry_date)
        ORDER BY month`,
        [months]
      );

      const recurring = await pool.query(
        `WITH monthly_expenses AS (
          SELECT lower(regexp_replace(trim(e.description), '\\s+', ' ', 'g')) AS expense_key,
            min(e.description) AS description,
            date_trunc('month', e.entry_date)::date AS month,
            sum(l.debit-l.credit) AS amount
          FROM journal_entries e
          JOIN journal_lines l ON l.journal_entry_id=e.id
          JOIN chart_of_accounts a ON a.id=l.account_id
          WHERE e.status='posted' AND e.source_type='expense' AND a.account_type='expense'
            AND e.entry_date >= current_date - interval '210 days'
          GROUP BY lower(regexp_replace(trim(e.description), '\\s+', ' ', 'g')), date_trunc('month', e.entry_date)
        )
        SELECT expense_key, min(description) AS description, count(*)::int AS months_seen,
          round(avg(amount),2)::text AS average_monthly_amount,
          round(sum(amount) FILTER (WHERE month=date_trunc('month', current_date)::date),2)::text AS current_month_amount,
          round(sum(amount) FILTER (WHERE month=(date_trunc('month', current_date)-interval '1 month')::date),2)::text AS previous_month_amount,
          max(month)::date::text AS last_recorded_month
        FROM monthly_expenses
        GROUP BY expense_key
        HAVING count(*) >= 2
        ORDER BY sum(amount) DESC
        LIMIT 12`
      );

      const supplierExposure = await pool.query(
        `SELECT count(*)::int AS open_invoices,
          COALESCE(sum(total_amount - amount_paid),0)::text AS outstanding_etb
         FROM supplier_invoices
         WHERE status IN ('posted','partially_paid')`
      ).catch(() => ({ rows: [{ open_invoices: 0, outstanding_etb: "0" }] }));

      const data = monthly.rows.map((row) => ({
        ...row,
        net_profit: (Number(row.revenue) - Number(row.expenses)).toFixed(2),
        gross_profit: (Number(row.revenue) - Number(row.cost_of_goods_sold)).toFixed(2)
      }));
      const current = data[data.length - 1];
      const previous = data[data.length - 2];
      const insights: { severity: "info" | "warning"; title: string; detail: string }[] = [];
      if (current && previous && Number(previous.revenue) > 0) {
        const change = (Number(current.revenue) - Number(previous.revenue)) / Number(previous.revenue);
        if (change <= -0.15) insights.push({ severity: "warning", title: "Revenue has fallen", detail: `Recorded revenue is ${Math.abs(change * 100).toFixed(1)}% below the previous month. Check foot traffic, stock-outs and pricing before changing purchasing plans.` });
        else if (change >= 0.15) insights.push({ severity: "info", title: "Revenue has increased", detail: `Recorded revenue is ${(change * 100).toFixed(1)}% above the previous month. Verify margin and cash collection before treating the increase as profit.` });
      }
      if (current && Number(current.net_profit) < 0) insights.push({ severity: "warning", title: "Negative recorded operating result", detail: "Posted ledger expenses exceed recorded revenue for this period. Check posting completeness and investigate the largest expense categories." });
      for (const item of recurring.rows) {
        const now = Number(item.current_month_amount ?? 0), before = Number(item.previous_month_amount ?? 0);
        if (before > 0 && now > before * 1.15) {
          insights.push({ severity: "warning", title: "Recurring cost increased", detail: `${item.description} is ${((now / before - 1) * 100).toFixed(1)}% higher this month than last month. Verify the supplier invoice or service price.` });
        }
      }
      if (!insights.length) insights.push({ severity: "info", title: "No material rule-based alerts", detail: "The current posted ledger does not trigger the configured revenue, loss or recurring-cost thresholds. This is not a substitute for reconciliation." });

      res.json({
        generatedAt: new Date().toISOString(),
        currency: "ETB",
        periodMonths: months,
        monthly: data,
        recurringCosts: recurring.rows,
        supplierExposure: supplierExposure.rows[0],
        insights,
        limitations: ["Analysis uses posted accounting journal entries only.", "Cash movement is the net change in cash and settlement accounts, not a bank-reconciled cash balance.", "Recurring-cost detection is based on repeated expense descriptions; similar costs with different descriptions may not be grouped.", "Insights are deterministic rules, not an AI-generated forecast."]
      });
    } catch (error) { next(error); }
  });

  return router;
}
