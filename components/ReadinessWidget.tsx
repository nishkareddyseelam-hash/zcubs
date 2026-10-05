import ScoreRing from "@/components/ScoreRing";

type ReadinessDim = { k: string; label: string; v: number; next: string };

/** Shared presentation for the Discovery/Validation readiness sub-score
 * panels — same explainable-dimensions data as before, now with a ring
 * gauge for the total instead of a flat number, matching the Venture
 * Readiness Score on the Passport page. */
export default function ReadinessWidget({
  title,
  total,
  dims,
}: {
  title: string;
  total: number;
  dims: ReadinessDim[];
}) {
  return (
    <div className="flex items-start gap-4 flex-wrap">
      <ScoreRing value={total} size={76} strokeWidth={8} />
      <div className="flex-1" style={{ minWidth: 200 }}>
        <h4 className="font-display text-[18px]">{title}</h4>
        <p style={{ fontSize: 14, color: "var(--text-faint)" }}>
          Explainable sub-scores, not a single guessed number — each one names exactly what would move it.
        </p>
        <div className="flex flex-col gap-2 mt-3">
          {dims.map((d) => (
            <div key={d.k}>
              <div className="flex justify-between" style={{ fontSize: 16 }}>
                <span>{d.label}</span>
                <span className="font-mono-plex">{d.v}%</span>
              </div>
              <div className="progress-track mt-1"><div className="progress-fill" style={{ width: `${d.v}%` }} /></div>
              <p style={{ fontSize: 14, color: "var(--text-faint)" }}>{d.next}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
