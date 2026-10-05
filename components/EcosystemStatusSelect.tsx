"use client";
import { useTransition } from "react";
import { updateEcosystemStatus } from "@/lib/actions";
import type { EcosystemContact } from "@/lib/repo";

const OPTIONS: EcosystemContact["applicationStatus"][] = ["not_started", "researching", "applied", "in_review", "awarded", "rejected", "declined"];
const LABEL: Record<string, string> = {
  not_started: "Not started", researching: "Researching", applied: "Applied", in_review: "In review",
  awarded: "Awarded / accepted", rejected: "Rejected", declined: "Declined by us",
};

export default function EcosystemStatusSelect({ id, initial }: { id: string; initial: EcosystemContact["applicationStatus"] }) {
  const [, startTransition] = useTransition();
  return (
    <select
      className="field-input"
      defaultValue={initial}
      onChange={(e) => startTransition(() => { updateEcosystemStatus(id, e.target.value as EcosystemContact["applicationStatus"]); })}
      style={{ maxWidth: 200 }}
    >
      {OPTIONS.map((o) => <option key={o} value={o}>{LABEL[o]}</option>)}
    </select>
  );
}
