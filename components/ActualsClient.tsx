"use client";
import { useState, useTransition } from "react";
import { logActuals, removeActuals } from "@/lib/actions";

type Row = { id: string; period: string; revenue: number; customers: number; costs: number; notes: string; forecastRevenue: number; varianceRevenuePct: number | null };

function inr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function ActualsClient({ rows, opportunityId }: { rows: Row[]; opportunityId?: string }) {
  const [, startTransition] = useTransition();
  const [period, setPeriod] = useState("");

  return (
    <div>
      <p style={{ fontSize: 15, color: "var(--text-faint)", maxWidth: "66ch" }}>
        There is no accounting integration in this build — every &quot;actual&quot; below is exactly what you type in, self-reported, compared
        arithmetically against your Money Lab base-case forecast for that same month number. No figure is imported or inferred.
      </p>
      {rows.length > 0 && (
        <div className="table-wrap mt-3">
          <table>
            <thead><tr><th>Period</th><th>Revenue (actual)</th><th>Forecast revenue</th><th>Variance</th><th>Customers</th><th>Costs</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono-plex">{r.period}</td>
                  <td className="font-mono-plex">{inr(r.revenue)}</td>
                  <td className="font-mono-plex" style={{ color: "var(--text-faint)" }}>{inr(r.forecastRevenue)}</td>
                  <td className="font-mono-plex" style={{ color: r.varianceRevenuePct === null ? "var(--text-faint)" : r.varianceRevenuePct >= 0 ? "var(--good)" : "var(--bad)" }}>
                    {r.varianceRevenuePct === null ? "—" : `${r.varianceRevenuePct >= 0 ? "+" : ""}${r.varianceRevenuePct.toFixed(0)}%`}
                  </td>
                  <td className="font-mono-plex">{Math.round(r.customers)}</td>
                  <td className="font-mono-plex">{inr(r.costs)}</td>
                  <td style={{ fontSize: 14, color: "var(--text-faint)" }}>{r.notes || "—"}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => startTransition(() => removeActuals(r.id))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form action={logActuals} className="grid md:grid-cols-5 gap-3 mt-4 items-end">
        <div>
          <label className="field-label">Period</label>
          <input name="period" type="month" required className="field-input" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div><label className="field-label">Revenue (₹)</label><input name="revenue" type="number" step="any" className="field-input" defaultValue={0} /></div>
        <div><label className="field-label">Customers</label><input name="customers" type="number" step="any" className="field-input" defaultValue={0} /></div>
        <div><label className="field-label">Costs (₹)</label><input name="costs" type="number" step="any" className="field-input" defaultValue={0} /></div>
        <div><label className="field-label">Notes</label><input name="notes" className="field-input" placeholder="optional" /></div>
        {opportunityId && <input type="hidden" name="opportunityId" value={opportunityId} />}
        <div className="md:col-span-5"><button type="submit" className="btn btn-primary btn-sm">Log this month</button></div>
      </form>
    </div>
  );
}
