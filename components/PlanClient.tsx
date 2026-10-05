"use client";
import { useState, useTransition } from "react";
import { saveBusinessPlanSection, loadPlanDraft } from "@/lib/actions";
import type { BusinessPlan } from "@/lib/repo";

const SECTIONS: [keyof Omit<BusinessPlan, "userId" | "updatedAt">, string, string][] = [
  ["executiveSummary", "Executive summary", "Who you serve and the problem, in your own words."],
  ["marketSection", "Market & evidence", "What you actually know about the market — assembled from your Evidence Lab."],
  ["businessModelSection", "Business model", "How you make money — assembled from your Money Lab base case."],
  ["goToMarketSection", "Validation & go-to-market", "How you're proving demand — assembled from your Validation Quest Lab."],
  ["opsSection", "Risks & operations", "What could go wrong and how you're handling it — assembled from your Risk register."],
];

export default function PlanClient({ initial }: { initial: BusinessPlan | { executiveSummary: string; marketSection: string; businessModelSection: string; goToMarketSection: string; opsSection: string } }) {
  const [data, setData] = useState(initial);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  function refreshFromData() {
    startSave(async () => {
      const draft = await loadPlanDraft();
      setData((prev) => ({ ...prev, ...draft }));
      setSaved(false);
    });
  }

  function save(formData: FormData) {
    startSave(async () => {
      await saveBusinessPlanSection(formData);
      setSaved(true);
    });
  }

  return (
    <form action={save}>
      <div className="flex justify-between items-center flex-wrap gap-3 mb-3">
        <p style={{ fontSize: 15, color: "var(--text-faint)", maxWidth: "60ch" }}>
          Every section starts assembled from real rows already in your account — direct quotes or a labelled &quot;not yet entered&quot; placeholder,
          never invented content. Edit freely; nothing here re-generates unless you click refresh.
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={refreshFromData} disabled={saving}>↻ Refresh from my data</button>
      </div>
      <div className="flex flex-col gap-4">
        {SECTIONS.map(([field, label, hint]) => (
          <div key={field} className="card pad">
            <label className="field-label" style={{ fontSize: 17 }}>{label}</label>
            <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 6 }}>{hint}</p>
            <textarea
              name={field}
              rows={4}
              className="field-input"
              value={data[field]}
              onChange={(e) => { setSaved(false); setData((prev) => ({ ...prev, [field]: e.target.value })); }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save plan"}</button>
        {saved && <span style={{ color: "var(--good)", fontSize: 15 }}>Saved.</span>}
      </div>
    </form>
  );
}
