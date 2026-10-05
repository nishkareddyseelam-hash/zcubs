"use client";
import { useState, useTransition } from "react";
import { saveGuideNotesAction } from "@/lib/actions";

export default function GuideNotes({ stepId, initialNotes }: { stepId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const max = 5000;

  function save() {
    startSave(async () => {
      await saveGuideNotesAction(stepId, notes);
      setSaved(true);
    });
  }

  return (
    <div className="card pad mt-4">
      <label className="field-label">Notes</label>
      <p style={{ fontSize: 14, color: "var(--text-faint)", marginBottom: 6 }}>Anything extra worth remembering about this step.</p>
      <textarea
        className="field-input"
        rows={3}
        maxLength={max}
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        onBlur={save}
      />
      <div className="flex items-center justify-between mt-1">
        <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{notes.length} / {max}</span>
        <span style={{ fontSize: 13, color: "var(--good)" }}>{saving ? "Saving…" : saved ? "Saved" : ""}</span>
      </div>
    </div>
  );
}
