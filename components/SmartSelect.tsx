"use client";
import { useEffect, useState } from "react";

/**
 * A single-value dropdown populated with live, context-aware suggestions
 * (from /api/suggest — real Claude API when configured, curated fallback
 * otherwise), plus an "Other — write my own" option that reveals a free-text
 * field. Submits as a single hidden <input name=...>, so it drops into any
 * existing <form action={serverAction}> unchanged.
 */
export default function SmartSelect({
  name,
  label,
  field,
  context,
  defaultValue,
  placeholder,
  helpText,
  onValueChange,
}: {
  name: string;
  label: string;
  field: string;
  context?: Record<string, string>;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  /** Optional: reports the current value up to a parent client component so
   * it can be used as live context for another SmartSelect/SmartChips. */
  onValueChange?: (value: string) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"ai" | "curated" | null>(null);
  const [mode, setMode] = useState<"select" | "custom">(defaultValue ? "custom" : "select");
  const [value, setValueState] = useState(defaultValue || "");
  const setValue = (v: string) => {
    setValueState(v);
    onValueChange?.(v);
  };

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
        const opts = data.suggestions || [];
        setOptions(opts);
        setSource(data.source || null);
        if (defaultValue && opts.includes(defaultValue)) setMode("select");
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

  return (
    <div>
      <label className="field-label">
        {label}
        {loading && <span style={{ fontWeight: 400, color: "var(--text-faint)" }}> · getting suggestions…</span>}
        {!loading && source === "ai" && <span style={{ fontWeight: 400, color: "var(--text-faint)" }}> · AI suggestions</span>}
      </label>
      {mode === "select" ? (
        <select
          className="field-input"
          value={options.includes(value) ? value : ""}
          onChange={(e) => {
            if (e.target.value === "__other__") {
              setMode("custom");
              setValue("");
            } else setValue(e.target.value);
          }}
        >
          <option value="" disabled>
            {placeholder || "Choose one…"}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="__other__">Other — write my own</option>
        </select>
      ) : (
        <div className="flex gap-2">
          <input
            className="field-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
          {options.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setMode("select");
                setValue("");
              }}
            >
              Use suggestions
            </button>
          )}
        </div>
      )}
      {helpText && (
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 4 }}>{helpText}</p>
      )}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
