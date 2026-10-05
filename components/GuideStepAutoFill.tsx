"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The "live effect" — mounted at the top of a Guide step page. If this step
 * has no content yet and real context exists (an Opportunity Card or a
 * named business), it calls /api/generate-guide-step, shows a visible
 * ~2 second "drafting" state so the founder can see it happening, then
 * refreshes so the server-rendered fields/items/SWOT appear already
 * filled in. If no context exists yet, it shows an inline "name your
 * business" prompt instead of silently leaving the step blank.
 */
export default function GuideStepAutoFill({
  chapterId,
  stepId,
  empty,
  hasContext,
}: {
  chapterId: string;
  stepId: string;
  empty: boolean;
  hasContext: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [needsContext, setNeedsContext] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!empty) return;
    if (!hasContext) {
      setNeedsContext(true);
      return;
    }
    let cancelled = false;
    setGenerating(true);
    const start = Date.now();
    (async () => {
      try {
        const res = await fetch("/api/generate-guide-step", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chapterId, stepId }),
        });
        const data: { ok?: boolean; needsContext?: boolean } = await res.json().catch(() => ({}));
        if (data.needsContext) {
          if (!cancelled) { setGenerating(false); setNeedsContext(true); }
          return;
        }
      } catch {
        // Falls through — the founder can still use the per-field "Draft
        // for me" buttons and the item-list "Add" forms by hand.
      }
      const elapsed = Date.now() - start;
      const minDelay = 1800; // visible ~2s "live" effect
      if (elapsed < minDelay) await new Promise((r) => setTimeout(r, minDelay - elapsed));
      if (!cancelled) {
        setGenerating(false);
        router.refresh();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, stepId, empty, hasContext]);

  async function submitBusinessName() {
    if (!businessName.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/guide-name-business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessName: businessName.trim(), notes: notes.trim() }),
      });
      setNeedsContext(false);
      setGenerating(true);
      const start = Date.now();
      await fetch("/api/generate-guide-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chapterId, stepId }),
      });
      const elapsed = Date.now() - start;
      const minDelay = 1800;
      if (elapsed < minDelay) await new Promise((r) => setTimeout(r, minDelay - elapsed));
      setGenerating(false);
      router.refresh();
    } catch {
      setSubmitting(false);
    }
  }

  if (needsContext) {
    return (
      <div className="card pad mt-4" style={{ borderLeft: "3px solid var(--accent)" }}>
        <h4 className="font-display" style={{ fontSize: 16 }}>Name your business to get a drafted starting point</h4>
        <p style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 4 }}>
          Z Cubs will draft a starting hypothesis for every field on this page (and the rest of the Guide as you visit it) — review and edit before treating it as fact.
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
        <button type="button" className="btn btn-primary btn-sm mt-3" disabled={!businessName.trim() || submitting} onClick={submitBusinessName}>
          {submitting ? "Setting up…" : "Draft this Guide for me"}
        </button>
      </div>
    );
  }

  if (!generating) return null;
  return (
    <div className="card pad mt-4" style={{ borderLeft: "3px solid var(--accent)" }}>
      <div className="flex items-center gap-2">
        <span className="guide-spinner" aria-hidden />
        <span style={{ fontSize: 15, color: "var(--text-dim)" }}>Drafting a starting hypothesis for this step from your business context…</span>
      </div>
    </div>
  );
}
