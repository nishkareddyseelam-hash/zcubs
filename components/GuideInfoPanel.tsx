"use client";
import { useState } from "react";

export default function GuideInfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="card pad mt-4" style={{ background: "var(--bg-raise)", borderLeft: "3px solid var(--accent)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display" style={{ fontSize: 17 }}>{title}</h4>
          <p className="mt-1" style={{ color: "var(--text-dim)", fontSize: 15, maxWidth: "70ch" }}>{children}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}
