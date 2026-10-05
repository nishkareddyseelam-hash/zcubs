"use client";
import { useState, useTransition } from "react";
import { recheckComparable } from "@/lib/actions";
import type { ComparableCompany } from "@/lib/repo";

const STATUS_LABEL: Record<string, string> = {
  unknown: "Unknown", operating: "Operating", shut_down: "Shut down", acquired: "Acquired", merged: "Merged",
};

export default function RecheckComparable({ item }: { item: ComparableCompany }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ComparableCompany["status"]>(item.status);
  const [note, setNote] = useState(item.statusNote);
  const [, startTransition] = useTransition();

  const stale = !item.lastRechecked || Date.now() - Date.parse(item.lastRechecked) > 90 * 24 * 60 * 60 * 1000;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge ${status === "operating" ? "badge-green" : status === "shut_down" ? "badge-red" : status === "unknown" ? "badge-grey" : "badge-teal"}`}>
          <span className="dot" />{STATUS_LABEL[status]}
        </span>
        {stale && <span className="badge badge-amber"><span className="dot" />{item.lastRechecked ? "Recheck due (90+ days)" : "Never rechecked"}</span>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Recheck status"}</button>
      </div>
      {open && (
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Updated status</label>
            <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value as ComparableCompany["status"])}>
              <option value="unknown">Unknown</option>
              <option value="operating">Operating</option>
              <option value="shut_down">Shut down</option>
              <option value="acquired">Acquired</option>
              <option value="merged">Merged</option>
            </select>
          </div>
          <div>
            <label className="field-label">What the (re-checked) source says now</label>
            <input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quote or summarize the current source" />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => startTransition(() => { recheckComparable(item.id, status, note); setOpen(false); })}
            >
              Save recheck ({new Date().toLocaleDateString("en-IN")})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
