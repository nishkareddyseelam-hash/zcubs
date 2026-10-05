"use client";
import { useState } from "react";
import { Badge } from "@/components/ui";
import type { EvidenceItem, Opportunity } from "@/lib/repo";

/** Interactive claims table: filterable by the active idea so the passport
 * stays connected to the one venture the founder is actually working
 * through, instead of showing every claim on the account undifferentiated. */
export default function PassportClaims({
  claims,
  opportunities,
  activeIdea,
}: {
  claims: EvidenceItem[];
  opportunities: Opportunity[];
  activeIdea: Opportunity | undefined;
}) {
  const [filter, setFilter] = useState<"all" | "active">(activeIdea ? "active" : "all");
  const visible = filter === "active" && activeIdea ? claims.filter((c) => c.opportunityId === activeIdea.id) : claims;

  return (
    <div>
      {activeIdea && (
        <div className="flex items-center gap-2 flex-wrap mt-1 mb-2">
          <button
            type="button"
            className={`btn btn-sm ${filter === "active" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter("active")}
          >
            {activeIdea.title} only ({claims.filter((c) => c.opportunityId === activeIdea.id).length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter("all")}
          >
            All account claims ({claims.length})
          </button>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="mt-2" style={{ color: "var(--text-faint)" }}>
          {filter === "active" ? "No claims linked to this idea yet — add one in the Evidence Lab." : "No claims logged yet — add evidence items in Evidence & Market."}
        </p>
      ) : (
        <>
          <div className="table-wrap mt-3">
            <table>
              <thead><tr><th>Claim</th><th>Evidence class</th><th>Publisher</th><th>Geography / period</th><th>Accessed</th><th>Idea</th></tr></thead>
              <tbody>{visible.map((c) => (
                <tr key={c.id}>
                  <td style={{ maxWidth: "32ch" }}>{c.claim}</td><td><Badge evClass={c.evClass} /></td><td style={{ color: "var(--text-faint)" }}>{c.publisher || "—"}</td>
                  <td style={{ color: "var(--text-faint)" }}>{[c.geography, c.dataPeriod].filter(Boolean).join(" · ") || "—"}</td>
                  <td style={{ color: "var(--text-faint)" }}>{c.accessDate || "—"}</td>
                  <td style={{ color: "var(--text-faint)" }}>{c.opportunityId ? opportunities.find((o) => o.id === c.opportunityId)?.title || "—" : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-2" style={{ fontSize: 15, color: "var(--text-faint)" }}>
            No claim here is silently updated — if a figure turns out to be wrong or stale, remove or re-add it explicitly. This is the honest
            substitute for a formal correction log until this build supports one.
          </p>
        </>
      )}
    </div>
  );
}
