"use client";
import { useEffect, useState } from "react";

const PENDING_TREND_PICKS_KEY = "zcubs.pendingTrendCategories";

/**
 * A multi-select chip picker for comma-separated fields (e.g. venture
 * categories), populated with live suggestions from /api/suggest plus a
 * free-text "Add" box. Submits as a single hidden <input name=...> holding
 * the comma-joined selection.
 *
 * Also the fix for the Trend Radar -> Founder Fit Map bug: when `field` is
 * "fitmap.categories", it reads any sector names the Trend Radar page's
 * "+ Add to my Founder Fit Map" buttons queued in localStorage, merges them
 * into the selection, and clears the queue — so clicking a sector there now
 * genuinely results in it appearing here.
 */
export default function SmartChips({
  name,
  label,
  field,
  context,
  defaultValue,
  placeholder,
  helpText,
}: {
  name: string;
  label: string;
  field: string;
  context?: Record<string, string>;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"ai" | "curated" | null>(null);
  const [selected, setSelected] = useState<string[]>(() =>
    (defaultValue || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const [customText, setCustomText] = useState("");
  const [justAdded, setJustAdded] = useState<string[]>([]);

  const contextKey = JSON.stringify(context || {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field, context }),
    })
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data: { suggestions?: string[]; source?: "ai" | "curated" }) => {
        if (cancelled) return;
        setOptions(data.suggestions || []);
        setSource(data.source || null);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, contextKey]);

  // Pull in any sectors queued from the Trend Radar page, once, on mount.
  useEffect(() => {
    if (field !== "fitmap.categories") return;
    try {
      const raw = window.localStorage.getItem(PENDING_TREND_PICKS_KEY);
      if (!raw) return;
      const picks: string[] = JSON.parse(raw);
      if (Array.isArray(picks) && picks.length) {
        setSelected((prev) => Array.from(new Set([...prev, ...picks])));
        setJustAdded(picks);
      }
      window.localStorage.removeItem(PENDING_TREND_PICKS_KEY);
    } catch {
      // Best-effort only.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);

  function toggle(o: string) {
    setSelected((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
  }
  function remove(o: string) {
    setSelected((prev) => prev.filter((x) => x !== o));
  }
  function addCustom() {
    const v = customText.trim();
    if (v && !selected.includes(v)) setSelected((prev) => [...prev, v]);
    setCustomText("");
  }

  const value = selected.join(", ");

  return (
    <div>
      <label className="field-label">
        {label}
        {loading && <span style={{ fontWeight: 400, color: "var(--text-faint)" }}> · getting suggestions…</span>}
        {!loading && source === "ai" && <span style={{ fontWeight: 400, color: "var(--text-faint)" }}> · AI + Trend Radar suggestions</span>}
      </label>

      {justAdded.length > 0 && (
        <p className="notice notice-good" style={{ marginBottom: 8, fontSize: 14 }}>
          Added from Trend Radar: {justAdded.join(", ")}
        </p>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 8 }}>
          {selected.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              style={{ cursor: "pointer" }}
              onClick={() => remove(s)}
              title="Remove"
            >
              {s} ✕
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {options
          .filter((o) => !selected.includes(o))
          .map((o) => (
            <button key={o} type="button" className="chip" style={{ cursor: "pointer" }} onClick={() => toggle(o)}>
              + {o}
            </button>
          ))}
      </div>

      <div className="flex gap-2" style={{ marginTop: 8 }}>
        <input
          className="field-input"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={placeholder || "Write your own, then Add"}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={addCustom}>
          Add
        </button>
      </div>
      {helpText && <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 4 }}>{helpText}</p>}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
