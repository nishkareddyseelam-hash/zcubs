"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Shown on the Guide landing page when the founder has never named a
 * business (didn't come via a home-page template). Saves a real seed
 * (profile-matched sourced sector, or a generic pattern) to guide_meta so
 * every step can draft itself live as the founder opens it — never leaves
 * the Guide sitting blank waiting for a trip to Trend Radar first. */
export default function GuideNameBusinessPrompt() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!businessName.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/guide-name-business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessName: businessName.trim(), notes: notes.trim() }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card pad mt-4" style={{ borderLeft: "3px solid var(--accent)" }}>
      <h4 className="font-display" style={{ fontSize: 17 }}>Name your business to get a fully drafted Guide</h4>
      <p style={{ fontSize: 15, color: "var(--text-dim)", marginTop: 4 }}>
        Every step below will draft its own starting hypothesis — fields, suggested items, even a SWOT — as you open it, live, in a couple of seconds.
        Review and edit anything before treating it as fact.
      </p>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="field-label">Business name</label>
          <input className="field-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business name" />
        </div>
        <div>
          <label className="field-label">Notes so far (optional)</label>
          <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you already know" />
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-sm mt-3" disabled={!businessName.trim() || submitting} onClick={submit}>
        {submitting ? "Setting up…" : "Get started"}
      </button>
    </div>
  );
}
