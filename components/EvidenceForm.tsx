"use client";
import SmartSelect from "@/components/SmartSelect";

/** Suggests CLAIMS TO GO VERIFY (research starting points, tailored to the
 * founder's active idea when one is set) — never fabricated facts. The
 * founder still has to find a real source, a real metric and a real
 * publisher before anything here counts as evidence; helpText says so. */
export default function EvidenceForm({
  ideaContext,
  opportunityId,
  existingItems,
}: {
  ideaContext?: { title: string; customer: string; problem: string; mission: string };
  opportunityId?: string;
  existingItems?: { id: string; claim: string }[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-3">
      <div className="md:col-span-2">
        <SmartSelect
          name="claim"
          label="Claim it supports"
          field="evidence.claim"
          context={ideaContext}
          placeholder="What is this evidence backing up?"
          helpText={
            ideaContext
              ? `Suggested things to go verify for "${ideaContext.title}" — pick one as a starting point, or write your own. These are research questions, not facts: you still need a real source and metric.`
              : "Pick a suggested research question, or write your own. These are research questions, not facts."
          }
        />
      </div>
      <div><label className="field-label">Metric / figure</label><input name="metric" className="field-input" placeholder="e.g. 38 responses, ₹1,400 median price" /></div>
      <div>
        <label className="field-label">Class</label>
        <select name="evClass" className="field-input" defaultValue="user">
          <option value="official">Official source</option><option value="company">Company disclosure</option>
          <option value="user">Your own input</option><option value="derived">Derived calculation</option>
          <option value="estimate">External estimate</option><option value="forecast">Forecast</option>
          <option value="analyst">Analyst interpretation</option><option value="assumption">Explicit assumption</option>
        </select>
      </div>
      <div><label className="field-label">Publisher / source</label><input name="publisher" className="field-input" placeholder="Who published or provided this?" /></div>
      <div><label className="field-label">URL (optional)</label><input name="url" className="field-input" placeholder="https://" /></div>
      <div><label className="field-label">Geography (optional)</label><input name="geography" className="field-input" placeholder="e.g. Bengaluru, India (national)" /></div>
      <div><label className="field-label">Data period (optional)</label><input name="dataPeriod" className="field-input" placeholder="e.g. FY2024-25, surveyed Aug 2026" /></div>
      <div><label className="field-label">Licence / usage terms (optional)</label><input name="license" className="field-input" placeholder="e.g. Government open data, your own survey" /></div>
      <div><label className="field-label">Date accessed (optional)</label><input name="accessDate" type="date" className="field-input" /></div>
      {!!existingItems?.length && (
        <div className="md:col-span-2">
          <label className="field-label">This corrects an earlier item? (optional)</label>
          <select name="supersedesId" className="field-input" defaultValue="">
            <option value="">No — this is a new, independent claim</option>
            {existingItems.map((it) => (
              <option key={it.id} value={it.id}>{it.claim.slice(0, 70)}{it.claim.length > 70 ? "…" : ""}</option>
            ))}
          </select>
          <p style={{ fontSize: 14, color: "var(--text-faint)", marginTop: 4 }}>
            Choosing one links this as a correction in the evidence trail, instead of leaving two claims silently disagreeing.
          </p>
        </div>
      )}
      {opportunityId && <input type="hidden" name="opportunityId" value={opportunityId} />}
      <div className="md:col-span-2"><button type="submit" className="btn btn-primary">Add to register</button></div>
    </div>
  );
}
