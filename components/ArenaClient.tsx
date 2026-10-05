"use client";
import { useState, useTransition } from "react";
import { setOpportunityDim } from "@/lib/actions";
import type { Opportunity } from "@/lib/repo";

const DIMS: [keyof Opportunity, string][] = [
  ["dimFit", "Founder fit"], ["dimEvidence", "Evidence of need"], ["dimCustomer", "Customer accessibility"],
  ["dimDefensibility", "Defensibility"], ["dimCapital", "Capital efficiency"], ["dimMargin", "Potential margin"],
  ["dimScale", "Scalability"], ["dimSocial", "Social value"],
];

export default function ArenaClient({ initial }: { initial: Opportunity[] }) {
  const [opportunities, setOpportunities] = useState(initial);
  const [weights, setWeights] = useState<Record<string, number>>({
    dimFit: 20, dimEvidence: 18, dimCustomer: 12, dimDefensibility: 10, dimCapital: 12, dimMargin: 10, dimScale: 8, dimSocial: 10,
  });
  const [, startTransition] = useTransition();

  function score(o: Opportunity) {
    let total = 0, wsum = 0;
    DIMS.forEach(([k]) => {
      const w = weights[k as string];
      total += ((o[k] as number) / 10) * w;
      wsum += w;
    });
    return wsum ? Math.round((total / wsum) * 100) : 0;
  }

  function updateDim(id: string, dim: string, value: number) {
    setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, [dim]: value } : o)));
    startTransition(() => {
      setOpportunityDim(id, dim, value);
    });
  }

  if (opportunities.length === 1) {
    return (
      <SingleIdeaDeepDive
        opportunity={opportunities[0]}
        weights={weights}
        setWeights={setWeights}
        score={score}
        updateDim={updateDim}
      />
    );
  }

  const ranked = [...opportunities].sort((a, b) => score(b) - score(a));

  return (
    <div>
      <div className="card pad">
        <h4 className="font-display text-[18px]">Weights</h4>
        <div className="mt-3 flex flex-col gap-3">
          {DIMS.map(([k, label]) => (
            <div key={k as string} className="flex items-center gap-3 flex-wrap">
              <label style={{ width: 220, fontSize: 18, color: "var(--text-dim)" }}>{label}</label>
              <input
                type="range" min={0} max={30} value={weights[k as string]}
                onChange={(e) => setWeights({ ...weights, [k as string]: +e.target.value })}
                style={{ flex: 1, minWidth: 120 }}
              />
              <span className="font-mono-plex" style={{ width: 44, textAlign: "right" }}>{weights[k as string]}</span>
            </div>
          ))}
        </div>
        <p className="mt-2" style={{ color: "var(--text-faint)" }}>
          Total weight: <span className="font-mono-plex">{Object.values(weights).reduce((a, b) => a + b, 0)}</span> (scores normalise automatically)
        </p>
      </div>

      <div className="card pad mt-5">
        <h4 className="font-display text-[18px]">Score each idea, 0–10, on every dimension</h4>
        <div className="table-wrap mt-3">
          <table>
            <thead><tr><th>Dimension</th>{opportunities.map((o) => <th key={o.id}>{o.title}</th>)}</tr></thead>
            <tbody>
              {DIMS.map(([k, label]) => (
                <tr key={k as string}>
                  <td>{label}</td>
                  {opportunities.map((o) => (
                    <td key={o.id}>
                      <input
                        type="number" min={0} max={10} style={{ width: 64 }} className="field-input"
                        value={o[k] as number}
                        onChange={(e) => updateDim(o.id, k as string, Math.max(0, Math.min(10, +e.target.value)))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card pad mt-5">
        <h4 className="font-display text-[18px]">Score, live</h4>
        <div className="mt-3 flex flex-col gap-4">
          {opportunities.map((o) => (
            <div key={o.id}>
              <div className="flex justify-between text-[18px]"><b>{o.title}</b><span className="font-mono-plex">{score(o)}/100</span></div>
              <div className="progress-track mt-1"><div className="progress-fill" style={{ width: `${score(o)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="notice mt-5">
        <b>At your current weights and scores:</b> &quot;{ranked[0].title}&quot; leads ({score(ranked[0])}/100). This reflects your own inputs, not an external judgement — revisit the scores as you gather more real evidence.
      </div>
    </div>
  );
}

/**
 * With only one Opportunity Card, a "comparison" would have to invent
 * something to compare against — a fabricated "similar idea," a made-up
 * peer venture, or an unverifiable "success score" like the ones the
 * competitor-landscape review specifically flagged as untrustworthy
 * (see IdeaProof's unexplained "success" methodology and its incorrect
 * "Color Health failed" label). Z Cubs doesn't have other users' ideas to
 * draw on, and won't simulate ones that don't exist.
 *
 * So a single idea gets a real, useful alternative: a structured deep dive
 * on the founder's own weighted dimensions — which ones are genuinely
 * strong, which are weak and why (grounded in what was actually entered on
 * the Opportunity Card), plus a direct link to real, sourced comparable
 * companies in Rival Radar and to the Evidence Lab, so any "comparison"
 * the founder wants stays anchored to real, citable facts rather than an
 * invented peer.
 */
function SingleIdeaDeepDive({
  opportunity, weights, setWeights, score, updateDim,
}: {
  opportunity: Opportunity;
  weights: Record<string, number>;
  setWeights: (w: Record<string, number>) => void;
  score: (o: Opportunity) => number;
  updateDim: (id: string, dim: string, value: number) => void;
}) {
  const o = opportunity;
  const dimScores = DIMS.map(([k, label]) => ({ k: k as string, label, v: o[k] as number, w: weights[k as string] }));
  const ranked = [...dimScores].sort((a, b) => b.v - a.v);
  const strongest = ranked.slice(0, 2).filter((d) => d.v >= 6);
  const weakest = [...dimScores].sort((a, b) => a.v - b.v).slice(0, 2).filter((d) => d.v <= 5);
  const overall = score(o);

  const hasEvidence = (o.evidenceNote || "").trim().length > 0 && o.evidenceClass !== "assumption";

  return (
    <div>
      <div className="notice notice-good">
        You have one Opportunity Card. Comparing it against another business or user would mean inventing data Z Cubs doesn&apos;t have — so instead,
        here&apos;s a full deep dive on this one idea, using only your own inputs. Add a second Opportunity Card whenever you want a real side-by-side.
      </div>

      <div className="card pad mt-5">
        <div className="flex justify-between items-baseline flex-wrap gap-2">
          <h4 className="font-display text-[20px]">{o.title}</h4>
          <span className="font-mono-plex" style={{ fontSize: 22 }}>{overall}/100</span>
        </div>
        <div className="progress-track mt-2"><div className="progress-fill" style={{ width: `${overall}%` }} /></div>
        <p className="mt-2" style={{ color: "var(--text-faint)", fontSize: 16 }}>
          This is a weighted self-assessment score from your own dimension ratings below — not a predicted success probability, and not a comparison
          to any other founder&apos;s idea.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <div className="card pad">
          <h4 className="font-display text-[18px]">Where this idea is strongest</h4>
          {strongest.length === 0 ? (
            <p className="mt-2" style={{ color: "var(--text-faint)" }}>No dimension is currently rated 6 or above — score the table below honestly as you learn more.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {strongest.map((d) => (
                <li key={d.k} style={{ fontSize: 17 }}>
                  <b>{d.label}</b> — rated {d.v}/10.{" "}
                  {d.k === "dimEvidence" && hasEvidence ? "Backed by the evidence note on this card." : d.k === "dimFit" ? "Reflects your own Self Discovery inputs." : "Your own judgement call — keep the reasoning behind it in mind as you validate."}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card pad">
          <h4 className="font-display text-[18px]">Where it needs the most work</h4>
          {weakest.length === 0 ? (
            <p className="mt-2" style={{ color: "var(--text-faint)" }}>Every dimension is already rated above 5 — double check these aren&apos;t optimistic guesses before trusting the total.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {weakest.map((d) => (
                <li key={d.k} style={{ fontSize: 17 }}>
                  <b>{d.label}</b> — rated {d.v}/10.{" "}
                  {d.k === "dimEvidence" && !hasEvidence ? "This card has no evidence note yet — add one in Opportunity Forest." : "Consider what real evidence would move this rating, then go get it."}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card pad mt-5">
        <h4 className="font-display text-[18px]">Weights</h4>
        <div className="mt-3 flex flex-col gap-3">
          {DIMS.map(([k, label]) => (
            <div key={k as string} className="flex items-center gap-3 flex-wrap">
              <label style={{ width: 220, fontSize: 18, color: "var(--text-dim)" }}>{label}</label>
              <input
                type="range" min={0} max={30} value={weights[k as string]}
                onChange={(e) => setWeights({ ...weights, [k as string]: +e.target.value })}
                style={{ flex: 1, minWidth: 120 }}
              />
              <span className="font-mono-plex" style={{ width: 44, textAlign: "right" }}>{weights[k as string]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card pad mt-5">
        <h4 className="font-display text-[18px]">Score this idea, 0–10, on every dimension</h4>
        <div className="mt-3 flex flex-col gap-3">
          {DIMS.map(([k, label]) => (
            <div key={k as string} className="flex items-center gap-3 flex-wrap">
              <label style={{ width: 220, fontSize: 18, color: "var(--text-dim)" }}>{label}</label>
              <input
                type="number" min={0} max={10} style={{ width: 64 }} className="field-input"
                value={o[k] as number}
                onChange={(e) => updateDim(o.id, k as string, Math.max(0, Math.min(10, +e.target.value)))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="notice mt-5">
        Want a real comparison instead of a self-assessment? <a href="/dashboard/rivals" style={{ color: "var(--accent)" }}>Rival Radar</a> has sourced,
        citable facts on real comparable businesses, and the <a href="/dashboard/evidence" style={{ color: "var(--accent)" }}>Evidence Lab</a> is where
        to log what you learn about them — that stays honest in a way a simulated peer idea never could. Add a second Opportunity Card any time for a
        direct, weighted, side-by-side comparison of your own two ideas.
      </div>
    </div>
  );
}
