"use client";
import { useState } from "react";
import { EVIDENCE_CLASSES } from "@/lib/realEvidence";

const TOUR_STAGES = [
  {
    key: "fitmap",
    name: "Self Discovery",
    tag: "Territory 1",
    desc: "You answer honest questions about your own strengths, time and capital — dropdowns give you a running start, and Trend Radar's real sourced sectors are one click away.",
    example: "e.g. \"10 hrs/week alongside college\" or \"₹0–₹25,000 personal savings\" — picked from suggestions, or your own words.",
  },
  {
    key: "opportunities",
    name: "Opportunity Forest",
    tag: "Territory 2",
    desc: "Every Opportunity Card forces you to say what your evidence actually is — a title and a guess doesn't count.",
    example: "Evidence classes range from \"Explicit assumption\" to \"Official source\" — the product only rewards the real ones.",
  },
  {
    key: "arena",
    name: "Idea Arena",
    tag: "Territory 3",
    desc: "Compare your own ideas side by side on the dimensions that matter to you — fit, evidence, defensibility, capital, margin.",
    example: "You set the weights; nothing is pre-scored for you.",
  },
  {
    key: "trends",
    name: "Trend Radar",
    tag: "Territory 6",
    desc: "Real, sourced Gen Z sector and consumer-brand signals with citations — context for your idea, not a rival list.",
    example: "Click a sector card to add it straight into your Founder Fit Map categories.",
  },
  {
    key: "validation",
    name: "Validation Quest Lab",
    tag: "Territory 8",
    desc: "Every experiment declares a hypothesis, method and threshold before it runs — you record only real results.",
    example: "The readiness score only credits an experiment once you say, honestly, whether it met its own threshold.",
  },
  {
    key: "passport",
    name: "Evidence Passport",
    tag: "Territory 9",
    desc: "A running register of every real, cited fact and every one of your own inputs — clearly told apart.",
    example: "Nothing here is presented as live data unless it's actually sourced.",
  },
];

export default function ProductTour() {
  const [active, setActive] = useState(TOUR_STAGES[0].key);
  const stage = TOUR_STAGES.find((s) => s.key === active) ?? TOUR_STAGES[0];
  const [evClass, setEvClass] = useState<string>("official");
  const evMeta = EVIDENCE_CLASSES[evClass];

  return (
    <div className="card pad">
      <div className="eyebrow">See the workspace, before you sign up</div>
      <h3 className="font-display text-[20px] mt-1">A real product tour — no fabricated numbers, no demo mascot</h3>

      <div className="tour-tabs mt-4">
        {TOUR_STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            className="tour-tab"
            data-active={s.key === active}
            onClick={() => setActive(s.key)}
            aria-pressed={s.key === active}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mt-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <div className="eyebrow">{stage.tag}</div>
        <h4 className="font-display text-[18px] mt-1">{stage.name}</h4>
        <p className="mt-2" style={{ color: "var(--text-dim)" }}>{stage.desc}</p>
        <p className="mt-2" style={{ color: "var(--text-faint)", fontSize: 15 }}>{stage.example}</p>
      </div>

      <div className="mt-6" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <h4 className="font-display text-[17px]">Try the evidence classifier</h4>
        <p className="mt-1" style={{ color: "var(--text-dim)", fontSize: 15 }}>
          Every claim in Z Cubs carries one of these real classes. Click one to see how it&apos;s treated.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(EVIDENCE_CLASSES).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              className="evidence-demo-btn"
              data-active={key === evClass}
              onClick={() => setEvClass(key)}
            >
              <span className={`badge ${meta.className}`} style={{ pointerEvents: "none" }}>
                <span className="dot" />
                {meta.label}
              </span>
            </button>
          ))}
        </div>
        {evMeta && (
          <p className="mt-3 notice" style={{ fontSize: 15 }}>
            {EV_CLASS_EXPLAIN[evClass] || "This class is tracked and shown honestly wherever it appears."}
          </p>
        )}
      </div>
    </div>
  );
}

const EV_CLASS_EXPLAIN: Record<string, string> = {
  official: "Counts toward your evidence score and is shown with a source link — the highest-confidence class.",
  company: "Treated as real, but scoped to what the company itself disclosed — not verified independently.",
  user: "Your own interviews, observations or inputs. Counts as real evidence, distinct from an assumption.",
  derived: "A calculation made from other evidence you've entered — shown with its inputs, not hidden.",
  estimate: "An external estimate, not a primary source — flagged so you don't over-trust it.",
  assumption: "Explicitly not evidence yet. The readiness score gives this zero credit on its own — on purpose.",
  notfound: "Used when a search for reliable evidence came up empty — shown honestly instead of a fabricated number.",
};
