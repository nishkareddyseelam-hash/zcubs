import Link from "next/link";
import type { Opportunity } from "@/lib/repo";

/** The connected single-idea journey, in order. Every step after
 * Opportunity Forest stays anchored to the same active idea so a founder
 * never has to re-find "what's next" in the side nav. */
export const JOURNEY_STEPS: { key: string; label: string; href: string }[] = [
  { key: "opportunities", label: "Opportunity Forest", href: "/dashboard/opportunities" },
  { key: "arena", label: "Idea Arena", href: "/dashboard/arena" },
  { key: "evidence", label: "Evidence Lab", href: "/dashboard/evidence" },
  { key: "rivals", label: "Rival Radar", href: "/dashboard/rivals" },
  { key: "validation", label: "Validation Quest Lab", href: "/dashboard/validation" },
  { key: "comparables", label: "Comparable Outcomes", href: "/dashboard/comparables" },
  { key: "money", label: "Money Lab", href: "/dashboard/money" },
  { key: "plan", label: "Business Plan", href: "/dashboard/plan" },
  { key: "dpr", label: "India Ledger", href: "/dashboard/dpr" },
  { key: "ecosystem", label: "Investor Ecosystem", href: "/dashboard/ecosystem" },
  { key: "passport", label: "Evidence Passport", href: "/dashboard/passport" },
];

export default function JourneyBar({
  step,
  activeIdea,
  opportunityCount,
}: {
  step: string;
  activeIdea: Opportunity | undefined;
  opportunityCount: number;
}) {
  const idx = JOURNEY_STEPS.findIndex((s) => s.key === step);
  const next = idx >= 0 && idx < JOURNEY_STEPS.length - 1 ? JOURNEY_STEPS[idx + 1] : null;

  if (opportunityCount === 0) {
    return (
      <div className="notice mt-4">
        No Opportunity Card yet — the connected journey (Arena → Evidence → Rival Radar → Validation → Money → Passport) starts once you have one.{" "}
        <Link href="/dashboard/opportunities" style={{ color: "var(--accent)" }}>Go create or generate one →</Link>
      </div>
    );
  }

  return (
    <div className="card pad mt-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="eyebrow" style={{ margin: 0 }}>Continuing with</span>
        <b style={{ fontSize: 18 }}>{activeIdea ? activeIdea.title : "no idea selected"}</b>
        {!activeIdea && opportunityCount > 1 && (
          <Link href="/dashboard/opportunities" style={{ color: "var(--accent)", fontSize: 15 }}>
            Choose which idea →
          </Link>
        )}
        <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
          {JOURNEY_STEPS.map((s, i) => (
            <span
              key={s.key}
              title={s.label}
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i <= idx ? "var(--accent)" : "var(--line)",
              }}
            />
          ))}
        </div>
      </div>
      {next && (
        <Link href={next.href} className="btn btn-ghost btn-sm">
          Next: {next.label} →
        </Link>
      )}
    </div>
  );
}
