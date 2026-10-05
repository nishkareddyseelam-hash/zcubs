"use client";

export default function ComparableForm({ opportunityId }: { opportunityId?: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-3">
      <div><label className="field-label">Comparable company name</label><input name="name" required className="field-input" placeholder="e.g. a company solving a similar problem" /></div>
      <div>
        <label className="field-label">Current status</label>
        <select name="status" className="field-input" defaultValue="unknown">
          <option value="unknown">Unknown — haven&apos;t verified yet</option>
          <option value="operating">Operating (as of the source below)</option>
          <option value="shut_down">Shut down (as of the source below)</option>
          <option value="acquired">Acquired</option>
          <option value="merged">Merged</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="field-label">What the source actually says (status note)</label>
        <textarea name="statusNote" rows={2} className="field-input" placeholder="Quote or summarize what your source says about current status — not a guess" />
      </div>
      <div><label className="field-label">Source publisher</label><input name="sourcePublisher" className="field-input" placeholder="e.g. company's own site, a news outlet" /></div>
      <div><label className="field-label">Source URL</label><input name="sourceUrl" className="field-input" placeholder="https://" /></div>
      <div className="md:col-span-2"><label className="field-label">Notes (optional)</label><textarea name="notes" rows={2} className="field-input" placeholder="Why this is a relevant comparable — model, geography, stage" /></div>
      {opportunityId && <input type="hidden" name="opportunityId" value={opportunityId} />}
      <div className="md:col-span-2"><button type="submit" className="btn btn-primary">Add comparable</button></div>
    </div>
  );
}
