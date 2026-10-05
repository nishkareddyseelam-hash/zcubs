import type { Badge } from "@/lib/repo";

/** Streak + badges, computed entirely from real activity_log rows and real
 * workspace data (repo.computeGamification) — every number here is an
 * earned fact, never a fabricated stat. "Level" is a display label derived
 * directly from earnedCount, not a separate score — it never implies
 * progress the badge grid below doesn't already show. */
function levelLabel(earnedCount: number, badgeTotal: number): string {
  if (earnedCount === 0) return "Level 1 — Getting Started";
  if (earnedCount >= badgeTotal) return `Level ${badgeTotal + 1} — All Badges Earned`;
  return `Level ${earnedCount + 1} — ${earnedCount} Earned`;
}

export default function GamificationPanel({
  streak,
  badges,
  earnedCount,
  badgeTotal,
}: {
  streak: number;
  badges: Badge[];
  earnedCount: number;
  badgeTotal: number;
}) {
  return (
    <div className="card pad">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="eyebrow">Momentum</div>
        <span className="level-chip" title="Your level is just your earned-badge count, relabelled — nothing hidden behind it.">
          🏆 {levelLabel(earnedCount, badgeTotal)}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span style={{ fontSize: 28 }} aria-hidden="true">🔥</span>
        <div>
          <div className="font-display text-[19px]">
            {streak > 0 ? `${streak}-day streak` : "No active streak yet"}
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 15 }}>
            {streak > 0
              ? "Consecutive days with at least one real action logged."
              : "Do one real thing in the workspace today to start a streak."}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4" style={{ fontSize: 14, color: "var(--text-faint)" }}>
        <span>Badges</span>
        <span className="font-mono-plex">{earnedCount}/{badgeTotal}</span>
      </div>
      <div className="progress-track mt-1"><div className="progress-fill" style={{ width: `${badgeTotal ? (earnedCount / badgeTotal) * 100 : 0}%` }} /></div>
      <div className="badge-grid mt-4">
        {badges.map((b) => (
          <div key={b.key} className="badge-tile" data-earned={b.earned} title={b.why}>
            <span className="badge-tile__icon" aria-hidden="true">{b.earned ? "🏅" : "🔒"}</span>
            <span className="badge-tile__label">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
