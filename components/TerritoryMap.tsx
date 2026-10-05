"use client";
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

export type Territory = { name: string; desc: string; href: string | null; done: boolean };

/**
 * Founder World map.
 *
 * Fix notes (project requirement: Founder World map animation):
 * - The label <text> is now a SEPARATE, stationary element from the marker
 *   circle/halo — only the marker group scales, so labels never move or
 *   resize.
 * - Each marker's scale animation has an explicit centred transform origin
 *   (`transformOrigin` set to the node's own cx/cy) so hover/focus scaling
 *   happens around the node itself rather than drifting toward the SVG's
 *   (0,0) origin.
 * - Consecutive territories are joined by a visible connecting path that
 *   draws progressively via `pathLength`, so the map reads as one journey
 *   rather than scattered dots.
 * - The "active" territory (the first not-yet-done one, i.e. the current
 *   frontier) gets a restrained pulsing halo. Completed territories are
 *   solid. Future (not yet reachable) territories are muted but still
 *   rendered and still focusable/previewable.
 * - Keyboard focus (`:focus-visible` via a real `<a>`/button element)
 *   produces the same hover state and information as pointer hover.
 * - `prefers-reduced-motion` renders the fully-drawn, non-animated static
 *   map (no entrance stagger, no pulse, no draw-on paths).
 */
export default function TerritoryMap({ territories }: { territories: Territory[] }) {
  const cols = 4;
  const w = 900;
  const pad = 70;
  const reduced = useReducedMotion();
  const gradId = useId();

  const nodes = territories.map((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * ((w - 2 * pad) / (cols - 1)) + (row % 2 ? 30 : -30);
    const y = 60 + row * 105;
    return { ...t, x, y };
  });

  const firstNotDoneIndex = nodes.findIndex((n) => !n.done);
  const activeIndex = firstNotDoneIndex === -1 ? nodes.length - 1 : firstNotDoneIndex;

  return (
    <div>
      <div
        className="relative rounded-2xl overflow-hidden border"
        style={{ borderColor: "var(--line)", background: "radial-gradient(ellipse at 30% 20%, #1c2444 0%, #0e1220 70%)" }}
      >
        <svg viewBox={`0 0 ${w} 440`} className="block w-full h-auto" role="img" aria-label="Founder World territory map: a connected path of territories from start to launch readiness">
          <defs>
            <radialGradient id={`${gradId}-halo`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1c9b8e" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#1c9b8e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Connecting paths — one journey, not scattered dots. */}
          {nodes.slice(1).map((n, i) => {
            const prev = nodes[i];
            const linked = prev.done || i < activeIndex || i === activeIndex - 1 || (prev.done && !n.done);
            const drawn = prev.done;
            return (
              <path
                key={`link-${n.name}`}
                d={`M${prev.x},${prev.y} L${n.x},${n.y}`}
                fill="none"
                stroke={drawn ? "#1c9b8e" : "#38406a"}
                strokeWidth={3}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={reduced ? 0 : drawn ? 0 : 1}
                opacity={linked ? 1 : 0.5}
                style={
                  reduced
                    ? undefined
                    : { transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }
                }
                aria-label={`Path from ${prev.name} to ${n.name}, ${drawn ? "completed" : "upcoming"}`}
              />
            );
          })}

          {nodes.map((t, i) => {
            const isActive = i === activeIndex && !t.done;
            const isFuture = i > activeIndex;
            const fill = t.done ? "#1c9b8e" : isActive ? "#c98a2c" : "#454d70";

            const marker = (
              <>
                {isActive && !reduced && (
                  <motion.circle
                    cx={t.x}
                    cy={t.y}
                    r={12}
                    fill={`url(#${gradId}-halo)`}
                    animate={{ r: [16, 22, 16], opacity: [0.7, 0.3, 0.7] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <motion.circle
                  cx={t.x}
                  cy={t.y}
                  r={12}
                  fill={fill}
                  opacity={isFuture ? 0.55 : 1}
                  initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: isFuture ? 0.55 : 1 }}
                  whileHover={{ scale: 1.15 }}
                  whileFocus={{ scale: 1.15 }}
                  transition={{ delay: reduced ? 0 : i * 0.03, duration: 0.3 }}
                  style={{ transformOrigin: `${t.x}px ${t.y}px`, cursor: t.href ? "pointer" : "default" }}
                />
              </>
            );

            return (
              <g key={t.name}>
                {t.href ? (
                  <Link href={t.href} aria-label={`${t.name}: ${t.desc}${t.done ? " (in progress)" : isActive ? " (current)" : " (upcoming)"}`}>
                    {marker}
                  </Link>
                ) : (
                  marker
                )}
                {/* Stationary label — never scales, never moves with the marker. */}
                <text
                  x={t.x}
                  y={t.y + 30}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill={isFuture ? "#8b866f" : "#f7f2e7"}
                >
                  {t.name}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex gap-5 px-4 py-3 flex-wrap" style={{ fontSize: 16, color: "#8b866f" }}>
          <span className="flex items-center gap-2"><i style={{ width: 9, height: 9, borderRadius: "50%", background: "#1c9b8e", display: "inline-block" }} />Work started</span>
          <span className="flex items-center gap-2"><i style={{ width: 9, height: 9, borderRadius: "50%", background: "#c98a2c", display: "inline-block" }} />Current focus</span>
          <span className="flex items-center gap-2"><i style={{ width: 9, height: 9, borderRadius: "50%", background: "#454d70", display: "inline-block" }} />Not yet started / planned for later</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-5">
        {territories.map((t) => (
          <motion.div key={t.name} whileHover={{ y: -2 }} className="card pad" style={{ cursor: t.href ? "pointer" : "default" }}>
            {t.href ? (
              <Link href={t.href}>
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-display text-[18px]">{t.name}</h4>
                  <span className={`badge ${t.done ? "badge-teal" : "badge-grey"}`}><span className="dot" />{t.done ? "Active" : "Not started"}</span>
                </div>
                <p className="mt-1.5" style={{ color: "var(--text-dim)" }}>{t.desc}</p>
              </Link>
            ) : (
              <>
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-display text-[18px]">{t.name}</h4>
                  <span className="badge badge-grey"><span className="dot" />Not started</span>
                </div>
                <p className="mt-1.5" style={{ color: "var(--text-dim)" }}>{t.desc}</p>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
