import { EVIDENCE_CLASSES } from "@/lib/realEvidence";

export function Badge({ evClass, text }: { evClass: string; text?: string }) {
  const meta = EVIDENCE_CLASSES[evClass] ?? EVIDENCE_CLASSES.assumption;
  return (
    <span className={`badge ${meta.className}`} title={meta.label}>
      <span className="dot" />
      {text || meta.label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card pad ${className}`}>{children}</div>;
}

export function Notice({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warn" | "good" }) {
  const cls = tone === "warn" ? "notice notice-warn" : tone === "good" ? "notice notice-good" : "notice";
  return <div className={cls}>{children}</div>;
}

export function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv-row">
      <span style={{ color: "var(--text-faint)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
