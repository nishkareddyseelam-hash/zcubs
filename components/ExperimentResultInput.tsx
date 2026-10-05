"use client";
import { useState, useTransition } from "react";
import { updateExperimentResult, updateExperimentVerdict } from "@/lib/actions";

export default function ExperimentResultInput({
  id,
  initial,
  initialVerdict,
}: {
  id: string;
  initial: string;
  initialVerdict: "yes" | "no" | "unknown";
}) {
  const [value, setValue] = useState(initial);
  const [verdict, setVerdict] = useState(initialVerdict);
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <input
        className="field-input"
        value={value}
        placeholder="Not yet run"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => startTransition(() => { updateExperimentResult(id, value); setVerdict("unknown"); })}
      />
      {/* Readiness scoring only counts this experiment as validating
          evidence when the founder explicitly says the result cleared the
          experiment's own stated threshold — recording any result is not
          the same as validating a hypothesis. */}
      <div>
        <label className="field-label" style={{ marginBottom: 4 }}>Did this result meet the threshold above?</label>
        <select
          className="field-input"
          value={verdict}
          onChange={(e) => {
            const v = e.target.value as "yes" | "no" | "unknown";
            setVerdict(v);
            startTransition(() => { updateExperimentVerdict(id, v); });
          }}
        >
          <option value="unknown">Not yet assessed</option>
          <option value="yes">Yes — threshold met</option>
          <option value="no">No — threshold not met</option>
        </select>
      </div>
    </div>
  );
}
