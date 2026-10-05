"use client";
import { useState } from "react";
import { addExperiment } from "@/lib/actions";
import SmartSelect from "@/components/SmartSelect";

/** Client wrapper so method/KPI/threshold suggestions can be tailored live
 * off the hypothesis and method the founder is actually entering — and, when
 * an active idea is set, off that idea's title/customer/problem too, so
 * suggested experiments actually connect to what's being tested. */
export default function ValidationForm({
  ideaContext,
  opportunityId,
}: {
  ideaContext?: { title: string; customer: string; problem: string; mission: string };
  opportunityId?: string;
}) {
  const [hypothesis, setHypothesis] = useState("");
  const [method, setMethod] = useState("");
  const [kpi, setKpi] = useState("");

  return (
    <form action={addExperiment} className="grid md:grid-cols-2 gap-4 mt-3">
      <div className="md:col-span-2">
        <SmartSelect
          name="name"
          label="Name"
          field="validation.name"
          context={ideaContext}
          placeholder="e.g. Landlord willingness-to-list interview"
        />
      </div>
      <div className="md:col-span-2">
        <SmartSelect
          name="hypothesis"
          label="Hypothesis"
          field="validation.hypothesis"
          context={ideaContext}
          placeholder="What specific, falsifiable belief are you testing?"
          onValueChange={setHypothesis}
        />
      </div>
      <SmartSelect
        name="method"
        label="Method"
        field="validation.method"
        context={{ hypothesis, ...ideaContext }}
        placeholder="How will you test it?"
        onValueChange={setMethod}
      />
      <SmartSelect
        name="kpi"
        label="KPI"
        field="validation.kpi"
        context={{ hypothesis, method, ...ideaContext }}
        placeholder="What will you measure?"
        onValueChange={setKpi}
      />
      <div className="md:col-span-2">
        <SmartSelect
          name="threshold"
          label="Success threshold"
          field="validation.threshold"
          context={{ hypothesis, method, kpi }}
          placeholder="e.g. ≥50% say yes = proceed"
        />
      </div>
      <div className="md:col-span-2">
        <label className="field-label">Stop rule</label>
        <input
          name="stopRule"
          className="field-input"
          placeholder="What result makes you actually pivot or stop? e.g. <20% say yes = drop this idea"
        />
        <p style={{ fontSize: 15, color: "var(--text-faint)" }}>
          A threshold says what counts as a win. A stop rule says what forces a real decision on a loss — so &quot;inconclusive&quot; doesn&apos;t
          quietly become &quot;keep going forever.&quot;
        </p>
      </div>
      {opportunityId && <input type="hidden" name="opportunityId" value={opportunityId} />}

      <div className="md:col-span-2">
        <label className="field-label">Does this experiment involve any of these, in real life?</label>
        <div className="flex flex-col gap-1 mt-1" style={{ fontSize: 14.5 }}>
          <label className="flex items-center gap-2"><input type="checkbox" name="involvesMoney" /> Real money changing hands (a payment, a pre-order, a deposit)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="involvesContract" /> Signing a contract or agreement</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="involvesStrangerContact" /> Contacting or meeting someone you don&apos;t already know</label>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 4 }}>
          Self-declared by you, not detected automatically. Explorer (13&ndash;17) accounts need a confirmed
          guardian on file before saving an experiment with any of these checked &mdash; see Privacy &amp; Consent.
        </p>
      </div>

      <div className="md:col-span-2">
        <button type="submit" className="btn btn-primary">Add experiment</button>
      </div>
    </form>
  );
}
