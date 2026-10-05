"use client";
import { useState, useTransition } from "react";
import { saveGuideItemsAction } from "@/lib/actions";

const QUADRANTS: { key: string; label: string; singular: string; hint: string; color: string }[] = [
  { key: "strengths", label: "Strengths", singular: "strength", hint: "What gives you an edge?", color: "var(--good)" },
  { key: "weaknesses", label: "Weaknesses", singular: "weakness", hint: "Where are you exposed?", color: "var(--bad)" },
  { key: "opportunities", label: "Opportunities", singular: "opportunity", hint: "What could you take advantage of?", color: "var(--accent)" },
  { key: "threats", label: "Threats", singular: "threat", hint: "What could hurt you?", color: "var(--gold, #d9971a)" },
];

type SwotItems = Record<string, string[]>;

/** A founder self-assessment tool, not a researched claim — four short-text
 * lists, each persisted as its own item list under this step. */
export default function GuideSwotGrid({ stepId, initialItems }: { stepId: string; initialItems: SwotItems }) {
  const [items, setItems] = useState<SwotItems>({
    strengths: initialItems.strengths || [],
    weaknesses: initialItems.weaknesses || [],
    opportunities: initialItems.opportunities || [],
    threats: initialItems.threats || [],
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, startSave] = useTransition();

  function add(key: string) {
    const text = (drafts[key] || "").trim();
    if (!text) return;
    const next = { ...items, [key]: [...items[key], text] };
    setItems(next);
    setDrafts((d) => ({ ...d, [key]: "" }));
    startSave(async () => { await saveGuideItemsAction(stepId, key, JSON.stringify(next[key])); });
  }
  function remove(key: string, i: number) {
    const next = { ...items, [key]: items[key].filter((_, idx) => idx !== i) };
    setItems(next);
    startSave(async () => { await saveGuideItemsAction(stepId, key, JSON.stringify(next[key])); });
  }

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      {QUADRANTS.map((q) => (
        <div key={q.key} className="card pad">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-[17px]" style={{ color: q.color }}>{q.label}</h4>
            {saving && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Saving…</span>}
          </div>
          <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 8 }}>{q.hint}</p>
          <ul style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {items[q.key].map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2" style={{ fontSize: 15, background: "var(--bg-raise)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
                <span>{t}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(q.key, i)}>✕</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className="field-input"
              placeholder={`Add a${/^[aeiou]/i.test(q.singular) ? "n" : ""} ${q.singular}…`}
              value={drafts[q.key] || ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [q.key]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q.key); } }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => add(q.key)}>Add</button>
          </div>
        </div>
      ))}
    </div>
  );
}
