"use client";
import { useState, useTransition } from "react";
import { saveGuideField } from "@/lib/actions";
import type { GuideFieldDef } from "@/lib/guideStructure";

/** One narrative (or select) field inside a Guide step. Textareas autosave
 * on blur (same pattern as the rest of Z Cubs' forms) and carry a char
 * counter; a field marked `ai` gets a "Draft with AI" button that calls
 * /api/generate-guide-field and fills the box with an honestly-labelled
 * hypothesis the founder must still review — never auto-saved unedited. */
export default function GuideFieldEditor({
  chapterId,
  stepId,
  field,
  initialValue,
  opportunity,
  profile,
  siblingValues,
}: {
  chapterId: string;
  stepId: string;
  field: GuideFieldDef;
  initialValue: string;
  opportunity?: { title?: string; customer?: string; problem?: string };
  profile?: { strengths?: string; categories?: string };
  siblingValues?: Record<string, string>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftSource, setDraftSource] = useState<"ai" | "curated" | null>(null);
  const max = 10000;

  function commit(next: string) {
    setValue(next);
    setSaved(false);
  }
  function save() {
    startSave(async () => {
      await saveGuideField(stepId, field.key, value);
      setSaved(true);
    });
  }

  async function draft() {
    setDrafting(true);
    try {
      const res = await fetch("/api/generate-guide-field", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chapterId, stepId, fieldKey: field.key, fieldLabel: field.label, opportunity, profile, stepContext: siblingValues }),
      });
      if (!res.ok) throw new Error("failed");
      const data: { text?: string; source?: "ai" | "curated" } = await res.json();
      if (data.text) {
        setValue(data.text);
        setDraftSource(data.source || "curated");
        setSaved(false);
      }
    } catch {
      // Silent fail — the founder can still write this field by hand.
    } finally {
      setDrafting(false);
    }
  }

  if (field.kind === "select") {
    return (
      <div>
        <label className="field-label">{field.label}</label>
        {field.hint && <p style={{ fontSize: 14, color: "var(--text-faint)", marginTop: -2, marginBottom: 6 }}>{field.hint}</p>}
        <select
          className="field-input"
          value={value}
          onChange={(e) => { commit(e.target.value); }}
          onBlur={save}
        >
          {(field.options || []).map((o) => (
            <option key={o} value={o}>{o || "Choose…"}</option>
          ))}
        </select>
        {saving && <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Saving…</span>}
        {saved && !saving && <span style={{ fontSize: 13, color: "var(--good)" }}> Saved</span>}
      </div>
    );
  }

  return (
    <div className="card pad">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="field-label" style={{ fontSize: 17 }}>{field.label}</label>
        {field.ai && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={draft} disabled={drafting}>
            {drafting ? "Drafting…" : "✨ Draft with AI"}
          </button>
        )}
      </div>
      {field.hint && <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 6 }}>{field.hint}</p>}
      {draftSource && (
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 6 }}>
          {draftSource === "ai" ? "AI-drafted" : "Template-scaffolded"} — this is a starting hypothesis, not researched fact. Review and edit before it counts as your plan.
        </p>
      )}
      <textarea
        className="field-input"
        rows={field.rows || 4}
        maxLength={max}
        value={value}
        placeholder={field.hint}
        onChange={(e) => commit(e.target.value)}
        onBlur={save}
      />
      <div className="flex items-center justify-between mt-1">
        <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{value.length} / {max}</span>
        <span style={{ fontSize: 13, color: "var(--good)" }}>{saving ? "Saving…" : saved ? "Saved" : ""}</span>
      </div>
    </div>
  );
}
