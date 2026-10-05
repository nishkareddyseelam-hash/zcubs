"use client";

export default function EcosystemForm({ opportunityId }: { opportunityId?: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-3">
      <div>
        <label className="field-label">Type</label>
        <select name="kind" className="field-input" defaultValue="investor">
          <option value="investor">Investor</option>
          <option value="incubator">Incubator</option>
          <option value="accelerator">Accelerator</option>
          <option value="grant">Grant / scheme</option>
          <option value="supplier">Supplier</option>
          <option value="lender">Lender</option>
        </select>
      </div>
      <div><label className="field-label">Name</label><input name="name" required className="field-input" placeholder="Who is this?" /></div>
      <div><label className="field-label">Focus / thesis (from their own materials)</label><input name="focus" className="field-input" placeholder="e.g. pre-seed consumer, India-focused" /></div>
      <div><label className="field-label">Stage they invest/support at</label><input name="stage" className="field-input" placeholder="e.g. idea stage, seed, Series A" /></div>
      <div><label className="field-label">Source URL</label><input name="sourceUrl" className="field-input" placeholder="https://" /></div>
      <div><label className="field-label">Application deadline (optional)</label><input name="deadline" type="date" className="field-input" /></div>
      <div className="md:col-span-2"><label className="field-label">Notes (optional)</label><textarea name="notes" rows={2} className="field-input" placeholder="Eligibility notes, how you'd reach them, anything else" /></div>
      {opportunityId && <input type="hidden" name="opportunityId" value={opportunityId} />}
      <div className="md:col-span-2"><button type="submit" className="btn btn-primary">Add to tracker</button></div>
    </div>
  );
}
