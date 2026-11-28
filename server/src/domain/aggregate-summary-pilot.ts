export type AggregateMetric = {
  key: "stockoutCount" | "expiryLossEtb" | "grossMarginPct" | "cashVarianceEtb";
  value: string;
  source: string;
};

export type AggregateSummaryInput = {
  reportId: string;
  periodStart: string;
  periodEnd: string;
  metrics: AggregateMetric[];
  pendingElectronicTenderExcluded: boolean;
};

export type AggregateSummaryContext = {
  mode: "draft_only";
  reportId: string;
  period: { start: string; end: string };
  metrics: AggregateMetric[];
  limitations: string[];
  forbiddenActions: string[];
};

const forbiddenActions = [
  "post journals",
  "alter stock",
  "settle tenders",
  "approve purchases",
  "change supplier balances",
  "issue refunds",
  "write to production data",
];

const forbiddenClaims = /\b(post|alter|settle|approve|issue|refund|reconcile|write|update)\b.{0,40}\b(journal|stock|tender|purchase|supplier|refund|ledger|production)\b/i;

function clean(value: unknown, max = 160): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function validIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function buildAggregateSummaryContext(input: AggregateSummaryInput): AggregateSummaryContext {
  if (!clean(input.reportId) || !validIsoDate(input.periodStart) || !validIsoDate(input.periodEnd)) {
    throw new Error("aggregate_report_period_or_id_required");
  }
  if (input.periodStart > input.periodEnd) throw new Error("aggregate_report_period_invalid");
  if (input.pendingElectronicTenderExcluded !== true) throw new Error("pending_electronic_tender_must_be_excluded");
  const metrics = (Array.isArray(input.metrics) ? input.metrics : []).slice(0, 20).map((metric) => ({
    key: metric.key,
    value: clean(metric.value, 80),
    source: clean(metric.source, 120),
  }));
  if (metrics.some((metric) => !metric.value || !metric.source)) throw new Error("aggregate_metric_source_required");
  return {
    mode: "draft_only",
    reportId: clean(input.reportId),
    period: { start: input.periodStart, end: input.periodEnd },
    metrics,
    limitations: ["Draft only; authoritative reports remain the source of truth.", "Manager/accountant review required before use."],
    forbiddenActions,
  };
}

export function validateAggregateSummaryDraft(text: string, context: AggregateSummaryContext) {
  const draft = clean(text, 4_000);
  if (!draft) return { ok: false as const, code: "empty_output" };
  if (forbiddenClaims.test(draft)) return { ok: false as const, code: "authoritative_action_claim" };
  if (!draft.includes(context.reportId)) return { ok: false as const, code: "report_id_missing" };
  if (!draft.includes("DRAFT") || !draft.toLowerCase().includes("review")) return { ok: false as const, code: "review_marker_missing" };
  return { ok: true as const, text: draft, requiresHumanReview: true };
}
