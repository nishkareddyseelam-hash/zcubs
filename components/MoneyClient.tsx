"use client";
import { useState, useTransition } from "react";
import { updateScenarioField } from "@/lib/actions";
import type { FinancialScenario } from "@/lib/repo";
import { computeMonthlyProjection, computeAnnualProjection } from "@/lib/financialModel";

const CORE_FIELDS: [keyof FinancialScenario, string, number, string][] = [
  ["price", "Price per unit (₹)", 0, "What you charge per order/subscription/unit — your own pricing plan, not a market average."],
  ["cac", "CAC (₹)", 0, "Customer Acquisition Cost — what you expect to spend to win one NEW paying customer. Applied only to units you actually acquire that month, never to your whole existing base."],
  ["churn", "Monthly churn (0–1)", 0.01, "Fraction of customers who stop each month. 0.05 = 5% leave monthly. Enter 0 if you're not modelling churn yet."],
  ["startUnits", "Starting units, month 1", 0, "How many units/customers you expect in your very first month."],
  ["growth", "New units added per month", 0, "New units/customers you win each month, BEFORE churn (below) takes any away — can be 0. Because churn keeps subtracting from your existing base every month, the P&L won't just repeat the same number even if this is 0."],
  ["fixedMonthly", "Fixed cost / month (₹)", 0, "Costs that don't scale with units — rent, salaries, tools, subscriptions."],
  ["cogsPct", "COGS % of revenue (0–1)", 0.01, "Cost of Goods Sold as a fraction of revenue. 0.35 = ₹0.35 of every ₹1 of revenue goes to direct costs."],
];

const ADVANCED_FIELDS: [keyof FinancialScenario, string, number, string][] = [
  ["annualPriceGrowthPct", "Annual price growth (%)", 1, "How much you plan to raise prices, once a year — not compounded monthly. 5 = a 5% step-up every 12 months. 0 = flat pricing throughout."],
  ["annualCacInflationPct", "Annual CAC inflation (%)", 1, "Acquisition typically gets pricier once you've exhausted the cheapest channels — model that drift here, once a year. 0 = CAC stays flat."],
  ["annualFixedCostInflationPct", "Annual fixed-cost inflation (%)", 1, "Rent, salaries and subscriptions typically rise with wage/price inflation — model that here, once a year. 0 = fixed costs stay flat."],
  ["taxRatePct", "Tax rate on profit (%)", 1, "A simplified flat rate applied only to months where EBITDA is positive — no depreciation or loss carry-forward modeled. Look up your own applicable rate (entity type, state, turnover slab all matter) rather than guessing one."],
  ["startingCash", "Starting cash / capital (₹)", 1000, "Cash you're actually starting with — savings, a disbursed loan, angel money already in the bank. Used only to compute the cash-runway figure below, never assumed."],
];

function inr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function MoneyClient({ initial }: { initial: Record<string, FinancialScenario> }) {
  const [scenario, setScenario] = useState<"conservative" | "base" | "upside" | "stress">("base");
  const [data, setData] = useState(initial);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [, startTransition] = useTransition();

  const d = data[scenario];
  const result = computeMonthlyProjection(d, 12);
  const [horizon, setHorizon] = useState<5 | 10>(5);
  const annual = computeAnnualProjection(d, horizon);

  function setField(field: keyof FinancialScenario, value: number) {
    setData((prev) => ({ ...prev, [scenario]: { ...prev[scenario], [field]: value } }));
    startTransition(() => { updateScenarioField(scenario, field as string, value); });
  }

  return (
    <div>
      <div className="flex gap-1 border-b mb-5 flex-wrap" style={{ borderColor: "var(--line)" }}>
        {(["conservative", "base", "upside", "stress"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className="pb-2.5 pr-4 text-[18px] font-semibold"
            style={{ color: scenario === s ? "var(--text)" : "var(--text-faint)", borderBottom: scenario === s ? "2px solid var(--accent)" : "2px solid transparent" }}
          >
            {s[0].toUpperCase() + s.slice(1)} case
          </button>
        ))}
      </div>

      <div className="notice">
        <b>How this works, in one pass:</b> pick a scenario tab above (conservative/base/upside/stress are four independent sets of the same
        assumptions — stress is meant for a deliberately harsh case: higher churn, slower growth, tighter margins), then fill in the core fields below
        with your own honest estimates for a monthly cadence. Every field starts at 0 — that&apos;s deliberate, not a bug. Units each month = last
        month&apos;s units × (1 − churn) + new units added, so churn is always eating into your base and the projection won&apos;t just repeat the same
        number every month/year. CAC is charged only against units you actually acquire that month, not your whole base. Open <b>Advanced assumptions</b>{" "}
        below to model price/cost drift, tax and a real cash-runway figure — every one of those still starts at 0 too. Nothing here is looked up or
        guessed on your behalf.
      </div>

      <div className="card pad mt-4">
        <h4 className="font-display text-[18px]">Assumptions ({scenario} case) <span className="badge badge-grey" style={{ marginLeft: 8 }}><span className="dot" />Explicit assumption</span></h4>
        <div className="grid md:grid-cols-3 gap-4 mt-3">
          {CORE_FIELDS.map(([field, label, step, hint]) => (
            <div key={field as string}>
              <label className="field-label">{label}</label>
              <input
                type="number" step={step || "any"} className="field-input"
                value={d[field] as number}
                onChange={(e) => setField(field, +e.target.value)}
              />
              <p style={{ fontSize: 14, color: "var(--text-faint)", marginTop: 4 }}>{hint}</p>
            </div>
          ))}
        </div>

        <details className="mt-4" open={showAdvanced} onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}>
          <summary className="btn btn-ghost btn-sm" style={{ display: "inline-flex", cursor: "pointer" }}>
            {showAdvanced ? "Hide" : "Show"} advanced assumptions — price/cost drift, tax, cash runway
          </summary>
          <div className="grid md:grid-cols-3 gap-4 mt-3">
            {ADVANCED_FIELDS.map(([field, label, step, hint]) => (
              <div key={field as string}>
                <label className="field-label">{label}</label>
                <input
                  type="number" step={step || "any"} className="field-input"
                  value={d[field] as number}
                  onChange={(e) => setField(field, +e.target.value)}
                />
                <p style={{ fontSize: 14, color: "var(--text-faint)", marginTop: 4 }}>{hint}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-5">
        <div className="card pad">
          <div className="eyebrow">Operating break-even</div>
          <div className="font-display text-[24px] mt-1">{result.breakEvenMonth ? `Month ${result.breakEvenMonth}` : "Not within 12mo"}</div>
          <p style={{ fontSize: 14, color: "var(--text-faint)" }}>First month that month&apos;s own net profit is ≥ 0.</p>
        </div>
        <div className="card pad">
          <div className="eyebrow">Cumulative payback</div>
          <div className="font-display text-[24px] mt-1">{result.paybackMonth ? `Month ${result.paybackMonth}` : "Not within 12mo"}</div>
          <p style={{ fontSize: 14, color: "var(--text-faint)" }}>First month total profit-to-date turns positive.</p>
        </div>
        <div className="card pad">
          <div className="eyebrow">Cash runway</div>
          <div className="font-display text-[24px] mt-1" style={{ color: result.runwayMonth ? "var(--bad)" : "var(--good)" }}>
            {result.runwayMonth ? `Runs out month ${result.runwayMonth}` : "No shortfall in 12mo"}
          </div>
          <p style={{ fontSize: 14, color: "var(--text-faint)" }}>Starting cash + cumulative net, month by month.</p>
        </div>
        <div className="card pad">
          <div className="eyebrow">LTV (formula)</div>
          <div className="font-display text-[24px] mt-1">{inr(result.ltv)}</div>
          <p style={{ fontSize: 14, color: "var(--text-faint)" }}>price × (1/churn) × (1−COGS%) — a steady-state approximation; ignores any price growth you set.</p>
        </div>
        <div className="card pad">
          <div className="eyebrow">LTV : CAC</div>
          <div className="font-display text-[24px] mt-1">{result.ratio !== null ? `${result.ratio.toFixed(1)} : 1` : "—"}</div>
          <p style={{ fontSize: 14, color: "var(--text-faint)" }}>Rule of thumb investors look for: ≥3:1.</p>
        </div>
      </div>

      <div className="card pad mt-5">
        <h4 className="font-display text-[18px]">12-month P&amp;L ({scenario} case)</h4>
        <div className="table-wrap mt-3">
          <table>
            <thead><tr><th>Month</th><th>Units</th><th>Revenue</th><th>COGS</th><th>Gross profit</th><th>Fixed cost</th><th>CAC spend</th><th>EBITDA</th><th>Tax</th><th>Net</th></tr></thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.m}>
                  <td>{r.m}</td><td className="font-mono-plex">{r.u}</td><td className="font-mono-plex">{inr(r.revenue)}</td>
                  <td className="font-mono-plex">{inr(r.cogs)}</td><td className="font-mono-plex">{inr(r.gross)}</td>
                  <td className="font-mono-plex">{inr(r.fixedCost)}</td><td className="font-mono-plex">{inr(r.cacSpend)}</td>
                  <td className="font-mono-plex">{inr(r.ebitda)}</td><td className="font-mono-plex">{inr(r.tax)}</td>
                  <td className="font-mono-plex" style={{ color: r.net >= 0 ? "var(--good)" : "var(--bad)" }}>{inr(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card pad mt-5">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h4 className="font-display text-[18px]">{horizon}-year outlook ({scenario} case)</h4>
          <div className="flex gap-1">
            {([5, 10] as const).map((h) => (
              <button key={h} type="button" className="btn btn-ghost btn-sm" style={horizon === h ? { background: "var(--accent)", color: "#fff" } : {}} onClick={() => setHorizon(h)}>{h}-year</button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 15, color: "var(--text-faint)" }}>Same formula as the monthly table above, run out longer and summed per year — not a separate model. Price, CAC and fixed costs step up once per year if you set a drift rate above.</p>
        <div className="table-wrap mt-3">
          <table>
            <thead><tr><th>Year</th><th>Units at year-end</th><th>Annual revenue</th><th>Annual EBITDA</th><th>Annual tax</th><th>Annual net</th></tr></thead>
            <tbody>
              {annual.map((r) => (
                <tr key={r.year}>
                  <td>Year {r.year}</td><td className="font-mono-plex">{r.endUnits}</td>
                  <td className="font-mono-plex">{inr(r.revenue)}</td>
                  <td className="font-mono-plex">{inr(r.ebitda)}</td>
                  <td className="font-mono-plex">{inr(r.tax)}</td>
                  <td className="font-mono-plex" style={{ color: r.net >= 0 ? "var(--good)" : "var(--bad)" }}>{inr(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="notice mt-5">
        No return, break-even date or growth curve here is a promise — the model only reflects the numbers you entered. Tax is a simplified flat rate
        on positive months only (no depreciation, no loss carry-forward); cash runway assumes no other inflows or outflows beyond this scenario&apos;s
        own P&amp;L.
      </div>
      <div className="flex gap-3 mt-4">
        <a href="/dashboard/plan" className="btn btn-ghost btn-sm">Business Plan &amp; Operate/Monitor →</a>
        <a href="/dashboard/dpr" className="btn btn-ghost btn-sm">India Ledger (DPR) →</a>
      </div>
    </div>
  );
}
