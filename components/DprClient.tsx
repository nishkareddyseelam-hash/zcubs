"use client";
import { useState, useTransition } from "react";
import { saveDprField } from "@/lib/actions";
import type { DprInputs } from "@/lib/repo";

const COST_FIELDS: [keyof DprInputs, string][] = [
  ["landBuilding", "Land & building (₹)"],
  ["machinery", "Machinery & equipment (₹)"],
  ["workingCapitalMargin", "Working capital margin (₹)"],
  ["preliminaryExpenses", "Preliminary & pre-operative expenses (₹)"],
  ["contingency", "Contingency (₹)"],
];
const FINANCE_FIELDS: [keyof DprInputs, string][] = [
  ["promoterContribution", "Promoter contribution (₹)"],
  ["termLoanAmount", "Term loan amount (₹)"],
  ["termLoanRatePct", "Term loan rate (% p.a.)"],
  ["termLoanTenureYears", "Term loan tenure (years)"],
  ["wcLoanAmount", "Working capital loan (₹)"],
  ["wcLoanRatePct", "Working capital loan rate (% p.a.)"],
];

function inr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function DprClient({
  initial,
  computed,
}: {
  initial: DprInputs;
  computed: {
    projectCost: number; meansOfFinance: number; reconciled: boolean;
    schedule: { emi: number; rows: { year: number; interest: number; principal: number; balance: number }[] };
    annualNet: number; dscr: number | null; emi: number;
  };
}) {
  const [data, setData] = useState(initial);
  const [, startTransition] = useTransition();
  const [c, setC] = useState(computed);

  function setField(field: keyof DprInputs, value: number) {
    setData((prev) => ({ ...prev, [field]: value }));
    startTransition(async () => {
      await saveDprField(field as string, value);
      // Recompute client-side with the same formulas so the page feels live;
      // the server value is the source of truth on next load.
      const next = { ...data, [field]: value };
      const projectCost = next.landBuilding + next.machinery + next.workingCapitalMargin + next.preliminaryExpenses + next.contingency;
      const meansOfFinance = next.promoterContribution + next.termLoanAmount + next.wcLoanAmount;
      setC((prev) => ({ ...prev, projectCost, meansOfFinance, reconciled: Math.abs(projectCost - meansOfFinance) < 1 }));
    });
  }

  return (
    <div>
      <div className="card pad">
        <h4 className="font-display text-[18px]">Project cost</h4>
        <div className="grid md:grid-cols-3 gap-4 mt-3">
          {COST_FIELDS.map(([f, label]) => (
            <div key={f}>
              <label className="field-label">{label}</label>
              <input type="number" step="any" className="field-input" value={data[f] as number} onChange={(e) => setField(f, +e.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-3"><b>Total project cost: </b><span className="font-mono-plex">{inr(c.projectCost)}</span></div>
      </div>

      <div className="card pad mt-4">
        <h4 className="font-display text-[18px]">Means of finance</h4>
        <div className="grid md:grid-cols-3 gap-4 mt-3">
          {FINANCE_FIELDS.map(([f, label]) => (
            <div key={f}>
              <label className="field-label">{label}</label>
              <input type="number" step="any" className="field-input" value={data[f] as number} onChange={(e) => setField(f, +e.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <b>Total means of finance: </b><span className="font-mono-plex">{inr(c.meansOfFinance)}</span>
          <span className={`badge ${c.reconciled ? "badge-green" : "badge-red"}`}><span className="dot" />{c.reconciled ? "Reconciles with project cost" : "Does not reconcile with project cost"}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="card pad">
          <div className="eyebrow">Term loan EMI (monthly)</div>
          <div className="font-display text-[22px] mt-1">{inr(computed.emi)}</div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Year-1 DSCR</div>
          <div className="font-display text-[22px] mt-1">{computed.dscr === null ? "—" : computed.dscr.toFixed(2)}</div>
          <p style={{ fontSize: 14, color: "var(--text-faint)" }}>
            (Money Lab base-case annual net + year-1 interest) ÷ (year-1 interest + principal). Approximate — annual net already includes Money Lab&apos;s simplified tax pass (flat rate on positive months, if you set one), but no depreciation is modelled.
          </p>
        </div>
        <div className="card pad">
          <div className="eyebrow">Base-case annual net (Money Lab)</div>
          <div className="font-display text-[22px] mt-1">{inr(computed.annualNet)}</div>
        </div>
      </div>

      {computed.schedule.rows.length > 0 && (
        <div className="card pad mt-4">
          <h4 className="font-display text-[18px]">Term loan repayment schedule (reducing balance)</h4>
          <div className="table-wrap mt-3">
            <table>
              <thead><tr><th>Year</th><th>Interest</th><th>Principal</th><th>Closing balance</th></tr></thead>
              <tbody>
                {computed.schedule.rows.map((r) => (
                  <tr key={r.year}>
                    <td>Year {r.year}</td>
                    <td className="font-mono-plex">{inr(r.interest)}</td>
                    <td className="font-mono-plex">{inr(r.principal)}</td>
                    <td className="font-mono-plex">{inr(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
