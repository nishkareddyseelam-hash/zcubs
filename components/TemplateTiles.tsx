"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Ready to click" starting templates for the home page, in the spirit of
 * IdeaBuddy's clickable idea-template tiles — but honestly scoped to this
 * product's evidence-governance rule: a tile never claims to hand the
 * founder a researched business idea. Each tile is either (a) one of the
 * real, cited Trend Radar sector signals already shown elsewhere in the
 * product, or (b) one of the generic, clearly-labelled venture-pattern
 * templates already used as the AI-off fallback for "Generate a draft".
 *
 * Clicking a tile first asks for a working business name (+ optional
 * notes), then lets the founder choose where to go: straight into an
 * Opportunity Card draft (same generation path as before), or into the
 * step-by-step Guide — which drafts a starting hypothesis for every
 * AI-eligible field across all 4 chapters from the template + business name
 * + notes, so the whole Guide already has something to review and edit.
 * Nothing is ever auto-saved unedited; every drafted field says so. */

const TREND_ICONS: Record<string, string> = {
  "Fintech & financial services": "💳",
  "Climate tech & clean mobility": "🌱",
  "AI, automation & cybersecurity": "🤖",
  "Creator economy & social": "🎥",
  "Consumer, retail & D2C": "🛍️",
  "Agritech & circular economy": "🌾",
  "Real estate, logistics & mobility": "🏙️",
  "Future of work & skilling": "🎓",
};

const PATTERN_ICONS: Record<string, string> = {
  marketplace: "🔁",
  concierge: "🛎️",
  subscription: "📦",
  "b2b-tool": "🧰",
};

type PendingTile = { category?: string; pattern?: string; label: string; sourceNote: string };

export default function TemplateTiles({ trendNames, categories }: { trendNames: string[]; categories: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingTile | null>(null);
  const [step, setStep] = useState<"name" | "choice">("name");
  const [businessName, setBusinessName] = useState("");
  const [notes, setNotes] = useState("");
  const [startingGuide, setStartingGuide] = useState(false);

  function openTrendTile(name: string) {
    setPending({ category: name, label: name, sourceNote: `Drafted from the sourced "${name}" sector trend you selected` });
    setBusinessName("");
    setNotes("");
    setStep("name");
  }
  function openPatternTile(id: string, label: string) {
    setPending({ pattern: id, label, sourceNote: `Drafted from the "${label}" pattern you selected` });
    setBusinessName("");
    setNotes("");
    setStep("name");
  }
  function closeModal() {
    if (startingGuide) return; // don't let a stray click abandon an in-flight request
    setPending(null);
  }

  function goToOpportunityCard() {
    if (!pending) return;
    const params = new URLSearchParams();
    if (pending.category) params.set("category", pending.category);
    if (pending.pattern) params.set("pattern", pending.pattern);
    if (businessName.trim()) params.set("businessName", businessName.trim());
    if (notes.trim()) params.set("notes", notes.trim());
    setPending(null);
    router.push(`/dashboard/opportunities?${params.toString()}`);
  }

  async function goToGuide() {
    if (!pending || !businessName.trim()) return;
    setStartingGuide(true);
    try {
      await fetch("/api/generate-guide-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          category: pending.category || "",
          pattern: pending.pattern || "",
          notes: notes.trim(),
        }),
      });
    } catch {
      // Falls through to navigation regardless — the Guide still opens even
      // if bulk-drafting failed partway; individual "Draft for me" buttons
      // still work per-field.
    } finally {
      setStartingGuide(false);
      setPending(null);
      router.push("/dashboard/guide");
    }
  }

  return (
    <section className="mt-6" aria-label="Ready-to-click starting templates">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="font-display text-[19px]">Ready-to-click starting templates</h3>
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: 16, maxWidth: "70ch" }}>
        Click a real, sourced sector signal or a generic venture pattern, name your business, then either add it as an Opportunity Card or open the
        step-by-step Guide with a starting draft already filled in for every step — review and edit every field before treating it as fact.
      </p>

      <div className="mt-3">
        <div className="eyebrow">Start from a sourced sector — Trend Radar</div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {trendNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => openTrendTile(name)}
              className="card pad"
              style={{ display: "block", textAlign: "left", textDecoration: "none", color: "inherit", transition: "transform .12s ease", width: "100%" }}
            >
              <div style={{ fontSize: 26 }}>{TREND_ICONS[name] || "📈"}</div>
              <div className="font-display" style={{ fontSize: 16, marginTop: 6, lineHeight: 1.25 }}>{name}</div>
              <div style={{ color: "var(--accent)", fontSize: 14, marginTop: 6, fontWeight: 600 }}>Use this template →</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="eyebrow">Or start from a generic venture pattern</div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openPatternTile(c.id, c.label)}
              className="card pad"
              style={{ display: "block", textAlign: "left", textDecoration: "none", color: "inherit", background: "var(--bg-raise)", width: "100%" }}
            >
              <div style={{ fontSize: 26 }}>{PATTERN_ICONS[c.id] || "✨"}</div>
              <div className="font-display" style={{ fontSize: 16, marginTop: 6 }}>{c.label}</div>
              <div style={{ color: "var(--text-faint)", fontSize: 14, marginTop: 6 }}>Fill-in-the-blank template →</div>
            </button>
          ))}
        </div>
      </div>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
          style={{ position: "fixed", inset: 0, background: "rgba(10,12,20,.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card pad"
            style={{ maxWidth: 480, width: "100%", maxHeight: "86vh", overflow: "auto", boxShadow: "var(--shadow-pop)" }}
          >
            {step === "name" ? (
              <>
                <div className="eyebrow">{pending.label}</div>
                <h3 className="font-display text-[20px] mt-1">Name your business</h3>
                <p className="mt-1" style={{ fontSize: 15, color: "var(--text-dim)" }}>
                  {pending.sourceNote} — give it a working name so Z Cubs can personalize your starting drafts. You can change this any time.
                </p>
                <div className="mt-3">
                  <label className="field-label">Business name</label>
                  <input
                    className="field-input"
                    autoFocus
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                  />
                </div>
                <div className="mt-3">
                  <label className="field-label">Notes / summary so far (optional)</label>
                  <textarea
                    className="field-input"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything you already know — the problem, the customer, why now…"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!businessName.trim()}
                    onClick={() => setStep("choice")}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="eyebrow">{businessName}</div>
                <h3 className="font-display text-[20px] mt-1">What would you like to do first?</h3>
                <p className="mt-1" style={{ fontSize: 15, color: "var(--text-dim)" }}>
                  Either way, everything drafted for you is a starting hypothesis built from this template and your own notes — review and edit before
                  treating it as fact.
                </p>
                <div className="flex flex-col gap-2 mt-4">
                  <button type="button" className="btn btn-primary" style={{ justifyContent: "flex-start" }} disabled={startingGuide} onClick={goToGuide}>
                    {startingGuide ? "Setting up your Guide…" : (
                      <>🧭 Open the step-by-step Guide <span style={{ fontWeight: 400, opacity: 0.85 }}>— all 20 steps drafted from {businessName}</span></>
                    )}
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ justifyContent: "flex-start" }} disabled={startingGuide} onClick={goToOpportunityCard}>
                    📇 Add as an Opportunity Card instead
                  </button>
                </div>
                <div className="mt-4">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={startingGuide} onClick={() => setStep("name")}>&larr; Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
