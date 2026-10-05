"use client";
import { useState, useTransition } from "react";
import { saveGuideItemsAction } from "@/lib/actions";
import type { GuideItemSchema } from "@/lib/guideStructure";
import { Notice } from "@/components/ui";

type Item = Record<string, string>;

function computeTotal(items: Item[], total: NonNullable<GuideItemSchema["total"]>): number {
  if (total.op === "sum") {
    return items.reduce((sum, it) => sum + (parseFloat(it[total.fieldKeys[0]]) || 0), 0);
  }
  // sumProduct: multiply the item's own fieldKeys together, then sum across items.
  return items.reduce((sum, it) => {
    const product = total.fieldKeys.reduce((p, k) => p * (parseFloat(it[k]) || 0), 1);
    return sum + product;
  }, 0);
}
function formatTotal(value: number, format: NonNullable<GuideItemSchema["total"]>["format"]): string {
  if (format === "currency") return "₹" + Math.round(value).toLocaleString("en-IN");
  if (format === "percent") return `${value % 1 === 0 ? value : value.toFixed(1)}%`;
  return value.toLocaleString("en-IN");
}

/** Generic "Add X" list builder used by every Guide step that needs a list
 * of typed items (products, marketing activities, team members, owners,
 * SWOT-adjacent lists elsewhere...). Renders an add form driven purely by
 * the step's itemSchema, and a card per saved item with an inline edit /
 * remove. The whole array is persisted as one JSON blob per (step, list). */
export default function GuideItemList({ stepId, schema, initialItems }: { stepId: string; schema: GuideItemSchema; initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [draft, setDraft] = useState<Item>({});
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [saving, startSave] = useTransition();

  function persist(next: Item[]) {
    setItems(next);
    startSave(async () => {
      await saveGuideItemsAction(stepId, schema.listKey, JSON.stringify(next));
    });
  }

  function addOrSave() {
    const hasContent = Object.values(draft).some((v) => (v || "").trim().length > 0);
    if (!hasContent) return;
    if (editingIdx !== null) {
      const next = items.map((it, i) => (i === editingIdx ? draft : it));
      persist(next);
      setEditingIdx(null);
    } else {
      persist([...items, draft]);
    }
    setDraft({});
  }
  function edit(i: number) {
    setDraft(items[i]);
    setEditingIdx(i);
  }
  function remove(i: number) {
    persist(items.filter((_, idx) => idx !== i));
    if (editingIdx === i) { setEditingIdx(null); setDraft({}); }
  }

  return (
    <div className="card pad mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-display text-[17px]">{schema.label}</h4>
        {saving && <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Saving…</span>}
      </div>

      {schema.total && items.length > 0 && (
        <div className="mt-2">
          <span style={{ fontSize: 15 }}><b>{schema.total.label}:</b> {formatTotal(computeTotal(items, schema.total), schema.total.format)}</span>
          {schema.total.warnIfNot !== undefined && Math.round(computeTotal(items, schema.total)) !== schema.total.warnIfNot && (
            <div className="mt-1"><Notice tone="warn">This doesn&apos;t add up to {schema.total.warnIfNot}{schema.total.format === "percent" ? "%" : ""} yet — not blocking, just flagging it so nothing is silently off.</Notice></div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          {items.map((it, i) => (
            <div key={i} className="card pad" style={{ background: "var(--bg-raise)" }}>
              <div className="flex items-start justify-between gap-2">
                <h5 className="font-display" style={{ fontSize: 16 }}>{it[schema.itemLabelKey] || "(untitled)"}</h5>
                <div className="flex items-center gap-1">
                  {schema.priority && (() => {
                    const vals = schema.priority!.fieldKeys.map((k) => parseFloat(it[k])).filter((v) => !isNaN(v));
                    if (!vals.length) return null;
                    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                    const label = avg >= 4 ? "High" : avg >= 2.5 ? "Medium" : "Low";
                    const color = avg >= 4 ? "var(--good)" : avg >= 2.5 ? "var(--warn)" : "var(--bad)";
                    return <span className="badge" style={{ borderColor: color, color, fontSize: 13, marginRight: 4 }} title="Calculated from your own 1-5 scores below — never invented">Priority: {label}</span>;
                  })()}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => edit(i)}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(i)}>Remove</button>
                </div>
              </div>
              {schema.fields.filter((f) => f.key !== schema.itemLabelKey).map((f) => (
                it[f.key] ? <p key={f.key} style={{ fontSize: 15, color: "var(--text-dim)", marginTop: 4 }}><b>{f.label}:</b> {it[f.key]}</p> : null
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 mt-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        {schema.fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
            <label className="field-label">{f.label}</label>
            {f.type === "textarea" ? (
              <textarea className="field-input" rows={2} placeholder={f.placeholder} value={draft[f.key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
            ) : f.type === "select" ? (
              <select className="field-input" value={draft[f.key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}>
                <option value="">Choose…</option>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="field-input" type={f.type === "number" ? "number" : "text"} placeholder={f.placeholder} value={draft[f.key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button type="button" className="btn btn-primary btn-sm" onClick={addOrSave}>
          {editingIdx !== null ? "Save changes" : schema.addLabel}
        </button>
        {editingIdx !== null && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => { setEditingIdx(null); setDraft({}); }}>Cancel</button>
        )}
      </div>
    </div>
  );
}
