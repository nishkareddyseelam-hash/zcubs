"use client";
import { useState, useEffect, useRef } from "react";
import { addOpportunity } from "@/lib/actions";
import SmartSelect from "@/components/SmartSelect";

type GeneratedIdea = { title: string; customer: string; problem: string; mission: string };

/** Client wrapper so the customer/mission suggestions can be tailored live
 * off the title the founder is actually typing, not just a static list.
 * Also offers an AI-assisted "generate a draft" option — founders can write
 * their own idea, or generate a starting draft (real AI when configured,
 * an honestly-labelled template otherwise) and edit every field before
 * saving. Nothing is ever auto-saved unedited.
 *
 * `initialCategory`/`initialPattern` let a "ready to click" template tile on
 * the home page (a real sourced Trend Radar sector, or a generic venture
 * pattern) pre-fill this exact form on arrival — same generation path as the
 * manual "Generate a draft" button, just pre-selected instead of random.
 * `initialBusinessName`/`initialNotes` come from the template's "name your
 * business" modal — when set, the business name replaces the generated
 * placeholder title outright, and the notes prefill the evidence note. */
export default function OpportunityForm({
  profile,
  initialCategory,
  initialPattern,
  initialBusinessName,
  initialNotes,
}: {
  profile?: { strengths: string; develop: string; categories: string };
  initialCategory?: string;
  initialPattern?: string;
  initialBusinessName?: string;
  initialNotes?: string;
}) {
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [problem, setProblem] = useState("");
  const [mission, setMission] = useState("");
  const [evidenceNote, setEvidenceNote] = useState(initialNotes || "");
  const [generating, setGenerating] = useState(false);
  const [genSource, setGenSource] = useState<"ai" | "curated" | "trend" | null>(null);
  const [genTrendName, setGenTrendName] = useState<string>("");
  const [formKey, setFormKey] = useState(0); // bump to force SmartSelect fields to re-init with new defaultValue
  const formRef = useRef<HTMLFormElement>(null);

  async function generateIdea(overrideCategory?: string, overridePattern?: string) {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-idea", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, category: overrideCategory, pattern: overridePattern }),
      });
      if (!res.ok) throw new Error("failed");
      const data: { idea?: GeneratedIdea; source?: "ai" | "curated" | "trend"; trendName?: string } = await res.json();
      if (data.idea) {
        // A business name typed into the template modal is the founder's
        // own real input — it replaces the generated placeholder title
        // outright rather than sitting alongside it.
        setTitle(initialBusinessName || data.idea.title || "");
        setCustomer(data.idea.customer || "");
        setProblem(data.idea.problem || "");
        setMission(data.idea.mission || "");
        setGenSource(data.source || "curated");
        setGenTrendName(data.trendName || "");
        setFormKey((k) => k + 1);
      }
    } catch {
      // Silent fail — the founder can still write their own idea by hand.
    } finally {
      setGenerating(false);
    }
  }

  // Runs once, only when the founder arrived here via a home-page template
  // tile (initialCategory/initialPattern set from the ?category=/?pattern=
  // URL params) — generates the matching draft automatically and scrolls the
  // form into view, so "click a template" really is one click.
  useEffect(() => {
    if (initialCategory || initialPattern) {
      generateIdea(initialCategory, initialPattern);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory, initialPattern]);

  return (
    <form ref={formRef} action={addOpportunity} className="grid md:grid-cols-2 gap-4 mt-3" key={formKey}>
      <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => generateIdea()} disabled={generating}>
          {generating ? "Generating…" : "✨ Generate a draft idea for me"}
        </button>
        {genSource && (
          <span style={{ fontSize: 14, color: "var(--text-faint)" }}>
            {genSource === "ai"
              ? "AI-drafted"
              : genSource === "trend"
                ? `Drafted from your Self Discovery profile + the sourced "${genTrendName}" sector trend`
                : "Template-drafted"} — review and edit every field before saving, this is a starting hypothesis, not researched fact.
          </span>
        )}
        {!profile?.categories && !profile?.strengths && (
          <span style={{ fontSize: 14, color: "var(--text-faint)" }}>
            Complete <a href="/dashboard/fitmap" style={{ color: "var(--accent)" }}>Self Discovery</a> first for a profile-matched draft.
          </span>
        )}
      </div>
      <div>
        <label className="field-label">Title</label>
        <input
          name="title"
          required
          className="field-input"
          placeholder="e.g. Verified subletting for outstation students"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <SmartSelect
        name="customer"
        label="Target customer"
        field="opportunities.customer"
        context={{ title }}
        defaultValue={customer}
        placeholder="Choose a customer segment…"
        onValueChange={setCustomer}
      />
      <div className="md:col-span-2">
        <label className="field-label">Problem, as you&apos;ve observed it</label>
        <textarea
          name="problem"
          rows={2}
          className="field-input"
          placeholder="Describe the problem you've actually seen or heard about"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Evidence class</label>
        <select name="evidenceClass" className="field-input" defaultValue="assumption">
          <option value="assumption">Assumption — not yet evidenced</option>
          <option value="user">Your own input (interview, observation)</option>
          <option value="estimate">External estimate</option>
          <option value="official">Official source</option>
        </select>
      </div>
      <div>
        <label className="field-label">Difficulty</label>
        <select name="difficulty" className="field-input" defaultValue="Medium">
          <option>Low</option><option>Medium</option><option>High</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="field-label">Evidence note</label>
        <input
          name="evidenceNote"
          className="field-input"
          placeholder="What is this claim actually based on?"
          value={evidenceNote}
          onChange={(e) => setEvidenceNote(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Capital intensity</label>
        <select name="capital" className="field-input" defaultValue="Medium">
          <option>Low</option><option>Medium</option><option>High</option>
        </select>
      </div>
      <SmartSelect
        name="mission"
        label="First validation mission"
        field="opportunities.mission"
        context={{ title, customer }}
        defaultValue={mission}
        placeholder="Choose a first test to run…"
        onValueChange={setMission}
      />
      <div className="md:col-span-2">
        <button type="submit" className="btn btn-primary">Add card</button>
      </div>
    </form>
  );
}
