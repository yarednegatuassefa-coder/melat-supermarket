import { useEffect, useMemo, useState } from "react";

type Month = { month: string; revenue: string; expenses: string; cost_of_goods_sold: string; net_cash_movement: string; net_profit: string; gross_profit: string };
type Recurring = { description: string; months_seen: number; average_monthly_amount: string; current_month_amount: string | null; previous_month_amount: string | null; last_recorded_month: string };
type Overview = { generatedAt: string; currency: string; periodMonths: number; monthly: Month[]; recurringCosts: Recurring[]; supplierExposure: { open_invoices: number; outstanding_etb: string }; insights: { severity: "info" | "warning"; title: string; detail: string }[]; limitations: string[] };

const money = (value: string | number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(Number(value ?? 0));
const monthLabel = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("en", { month: "short", year: "2-digit" });

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

export default function FinancialIntelligence() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api<Overview>(`/api/finance-intelligence/overview?months=${months}`)
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load financial intelligence."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [months]);

  const totals = useMemo(() => {
    const rows = data?.monthly ?? [];
    return rows.reduce((sum, row) => ({
      revenue: sum.revenue + Number(row.revenue),
      expenses: sum.expenses + Number(row.expenses),
      profit: sum.profit + Number(row.net_profit),
      cash: sum.cash + Number(row.net_cash_movement)
    }), { revenue: 0, expenses: 0, profit: 0, cash: 0 });
  }, [data]);
  const maxRevenue = Math.max(1, ...(data?.monthly ?? []).map((row) => Number(row.revenue)));

  return <div className="fi-page">
    <section className="fi-hero">
      <div><span className="eyebrow light">OWNER / MANAGER INTELLIGENCE</span><h2>See the money.<br/>Understand the business.</h2><p>Read-only analysis of Melat's posted ledger. No financial entries are created or changed here.</p></div>
      <div className="fi-hero-mark">M</div>
    </section>
    <div className="fi-toolbar"><div><span className="eyebrow">FINANCIAL PERFORMANCE</span><h2>Management overview</h2></div><label>Analysis window<select value={months} onChange={(event) => setMonths(Number(event.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></label></div>
    {loading && <div className="fi-empty">Reading the posted ledger…</div>}
    {error && <div className="fi-error">{error}</div>}
    {!loading && !error && data && <>
      <div className="fi-kpis">
        <article><span>RECORDED REVENUE</span><strong>{money(totals.revenue)}</strong><small>Across selected months</small></article>
        <article><span>RECORDED EXPENSES</span><strong>{money(totals.expenses)}</strong><small>Posted P&L expense accounts</small></article>
        <article><span>NET RESULT</span><strong className={totals.profit < 0 ? "negative" : ""}>{money(totals.profit)}</strong><small>Revenue less recorded expenses</small></article>
        <article><span>SUPPLIER INVOICES</span><strong>{money(data.supplierExposure.outstanding_etb)}</strong><small>{data.supplierExposure.open_invoices} open / partly paid</small></article>
      </div>
      <section className="fi-panel">
        <div className="fi-panel-head"><div><span className="eyebrow">MONTHLY TREND</span><h3>Revenue, expenses and net result</h3></div><small>ETB · posted entries</small></div>
        {data.monthly.length === 0 ? <div className="fi-empty">No posted ledger entries exist in this period. Record and post real transactions before relying on analysis.</div> :
          <div className="fi-chart">{data.monthly.map((row) => <div className="fi-chart-month" key={row.month}>
            <div className="fi-bars"><span className="revenue" style={{ height: `${Math.max(3, Number(row.revenue) / maxRevenue * 100)}%` }} title={`Revenue ${money(row.revenue)}`}/><span className="expense" style={{ height: `${Math.max(3, Number(row.expenses) / maxRevenue * 100)}%` }} title={`Expenses ${money(row.expenses)}`}/></div>
            <b>{monthLabel(row.month)}</b><small>{money(row.net_profit)}</small>
          </div>)}</div>}
        <div className="fi-legend"><span><i className="revenue"/> Revenue</span><span><i className="expense"/> Expenses</span></div>
      </section>
      <div className="fi-columns">
        <section className="fi-panel"><div className="fi-panel-head"><div><span className="eyebrow">RULE-BASED SIGNALS</span><h3>Management alerts</h3></div><small>{data.insights.length} signals</small></div>
          <div className="fi-insights">{data.insights.map((item, index) => <article className={item.severity} key={index}><b>{item.title}</b><p>{item.detail}</p></article>)}</div>
        </section>
        <section className="fi-panel"><div className="fi-panel-head"><div><span className="eyebrow">COST CONTROL</span><h3>Recurring expenses</h3></div></div>
          {data.recurringCosts.length === 0 ? <div className="fi-empty">No repeated expense descriptions found yet. Detection improves as recurring expenses are consistently described and posted.</div> :
            <div className="fi-recurring">{data.recurringCosts.map((item) => <div key={item.description}><div><b>{item.description}</b><small>Seen in {item.months_seen} months · last {monthLabel(item.last_recorded_month)}</small></div><strong>{money(item.average_monthly_amount)}<small>avg / month</small></strong></div>)}</div>}
        </section>
      </div>
      <section className="fi-panel"><div className="fi-panel-head"><div><span className="eyebrow">MONTH-BY-MONTH DETAIL</span><h3>Financial ledger summary</h3></div></div>
        <div className="table-wrap"><table><thead><tr><th>MONTH</th><th className="numeric">REVENUE</th><th className="numeric">COGS</th><th className="numeric">EXPENSES</th><th className="numeric">NET RESULT</th><th className="numeric">CASH MOVEMENT</th></tr></thead><tbody>{data.monthly.map((row) => <tr key={row.month}><td><b>{monthLabel(row.month)}</b></td><td className="numeric">{money(row.revenue)}</td><td className="numeric">{money(row.cost_of_goods_sold)}</td><td className="numeric">{money(row.expenses)}</td><td className="numeric">{money(row.net_profit)}</td><td className="numeric">{money(row.net_cash_movement)}</td></tr>)}</tbody></table></div>
      </section>
      <details className="fi-limitations"><summary>Methodology and limitations</summary><ul>{data.limitations.map((item) => <li key={item}>{item}</li>)}</ul><small>Generated {new Date(data.generatedAt).toLocaleString()} · ETB nominal values · no inflation adjustment</small></details>
    </>}
  </div>;
}
