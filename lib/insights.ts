// Insight library (D-021, docs/DECISION_LOG.md) — curated, human-reviewed
// examples drawn from real founders' own saved work, used as few-shot
// reference material in AI prompts so drafts feel grounded in real Gen Z
// founder patterns instead of generic advice.
//
// Two hard rules, both load-bearing:
//   1. Nothing goes live automatically. A founder opting in only creates a
//      PENDING candidate; a platform_super_administrator must read it,
//      strip anything identifying, and write the anonymized version
//      themselves before it's ever shown to another founder — the same
//      "self-attestation but human-reviewed" pattern as D-013 (mentor
//      attestation) and D-010 (deletion filed as pending, executed
//      separately). There is no auto-anonymization step to trust.
//   2. This never trains or fine-tunes the underlying AI model — Anthropic's
//      API doesn't do that, and docs/legal/PRIVACY_POLICY.md's existing
//      promise ("we do not use your content to train external AI models")
//      is unaffected. Approved examples are spliced into the system prompt
//      sent to Anthropic at call time — the same "your prompt is sent to
//      the AI provider to generate a draft" data flow already disclosed —
//      never uploaded anywhere as training data.
import { q, qOne, newId, now } from "./pg";
import { getUserById } from "./repo";
import { hasConfirmedGuardianConsent, recordConsent } from "./consent";
import { requireRole } from "./institutional";

export const INSIGHT_CATEGORIES = ["idea_generation", "financial_model", "suggestion"] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export type InsightCandidate = {
  id: string;
  category: InsightCategory;
  sourceUserId: string | null;
  sourceRefType: string | null;
  sourceRefId: string | null;
  submittedText: string;
  anonymizedText: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
};

const COLS = `
  id, category, source_user_id AS "sourceUserId", source_ref_type AS "sourceRefType",
  source_ref_id AS "sourceRefId", submitted_text AS "submittedText", anonymized_text AS "anonymizedText",
  status, reviewed_by AS "reviewedBy", review_note AS "reviewNote",
  created_at::text AS "createdAt", updated_at::text AS "updatedAt"
`;

/**
 * A founder opts in to share one real, specific piece of their own work so
 * it can, after a human reviews and rewrites it, help the AI guide other
 * founders. Only ever called from an explicit action the founder took —
 * never inferred, never automatic, never bundled into a general "accept
 * terms" checkbox. `refType`/`refId` (e.g. "opportunity", the card's own
 * id) prevent the same card being submitted twice.
 *
 * Explorer (13-17) accounts need a confirmed guardian relationship first —
 * sharing a minor's own work to shape what other users see is a real-world
 * data-sharing decision, the same category of thing D-012 already gates
 * (real money, a contract, contacting a stranger) behind guardian consent.
 */
export async function submitInsightCandidate(
  userId: string,
  category: InsightCategory,
  text: string,
  ref?: { type: string; id: string }
): Promise<InsightCandidate> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Nothing to share — that content is empty.");
  if (!(INSIGHT_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`Unknown insight category: ${category}`);
  }

  const user = await getUserById(userId);
  if (user?.ageBand === "explorer" && !(await hasConfirmedGuardianConsent(userId))) {
    throw new Error(
      "Sharing your work to help train Z Cubs' AI is a real-world data-sharing decision. Explorer accounts need a confirmed guardian (Privacy & Consent page) before doing this."
    );
  }

  if (ref) {
    const existing = await qOne(
      `SELECT 1 FROM insight_candidates WHERE source_ref_type=$1 AND source_ref_id=$2`,
      [ref.type, ref.id]
    );
    if (existing) throw new Error("You've already shared this — no need to share it again.");
  }

  await recordConsent(userId, "ai_insight_sharing", true, "self", `Submitted a ${category} example for review.`);

  const id = newId();
  await q(
    `INSERT INTO insight_candidates (id, category, source_user_id, source_ref_type, source_ref_id, submitted_text, status, review_note, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'pending','',$7,$7)`,
    [id, category, userId, ref?.type ?? null, ref?.id ?? null, trimmed, now()]
  );
  return (await qOne<InsightCandidate>(`SELECT ${COLS} FROM insight_candidates WHERE id=$1`, [id]))!;
}

/** True if this exact ref has already been submitted (any status) — used
 * by the UI to show "already shared" instead of a share button. */
export async function hasSubmittedInsightForRef(refType: string, refId: string): Promise<boolean> {
  const row = await qOne(`SELECT 1 FROM insight_candidates WHERE source_ref_type=$1 AND source_ref_id=$2`, [refType, refId]);
  return !!row;
}

/** Platform-admin-only. Everything awaiting human review, oldest first. */
export async function listPendingInsightCandidates(actorUserId: string): Promise<InsightCandidate[]> {
  await requireRole(actorUserId, "platform_super_administrator", "platform", "platform");
  return q<InsightCandidate>(`SELECT ${COLS} FROM insight_candidates WHERE status='pending' ORDER BY created_at ASC`);
}

/**
 * Approves a candidate — REQUIRES the admin to write the anonymized text
 * themselves (never auto-derived from the original) so a name, email, or
 * other identifying detail can never slip through untouched.
 */
export async function approveInsightCandidate(
  actorUserId: string,
  id: string,
  anonymizedText: string,
  note = ""
): Promise<InsightCandidate> {
  await requireRole(actorUserId, "platform_super_administrator", "platform", "platform");
  const clean = anonymizedText.trim();
  if (!clean) throw new Error("An approved example needs real anonymized text — it can't be blank.");
  await q(
    `UPDATE insight_candidates SET status='approved', anonymized_text=$1, reviewed_by=$2, review_note=$3, updated_at=$4
     WHERE id=$5 AND status='pending'`,
    [clean, actorUserId, note, now(), id]
  );
  const row = await qOne<InsightCandidate>(`SELECT ${COLS} FROM insight_candidates WHERE id=$1`, [id]);
  if (!row) throw new Error("Candidate not found.");
  if (row.status !== "approved") throw new Error("That candidate wasn't pending anymore — someone else may have already reviewed it.");
  return row;
}

export async function rejectInsightCandidate(actorUserId: string, id: string, note = ""): Promise<InsightCandidate> {
  await requireRole(actorUserId, "platform_super_administrator", "platform", "platform");
  await q(
    `UPDATE insight_candidates SET status='rejected', reviewed_by=$1, review_note=$2, updated_at=$3 WHERE id=$4 AND status='pending'`,
    [actorUserId, note, now(), id]
  );
  const row = await qOne<InsightCandidate>(`SELECT ${COLS} FROM insight_candidates WHERE id=$1`, [id]);
  if (!row) throw new Error("Candidate not found.");
  return row;
}

/**
 * What AI call sites actually use — a handful of real, approved,
 * anonymized examples for one category, in random order so the same two
 * examples don't dominate every draft. Returns [] (never fabricated
 * filler) until an admin has approved at least one for this category.
 */
export async function getActiveInsightExamples(category: InsightCategory, limit = 2): Promise<string[]> {
  const rows = await q<{ anonymizedText: string }>(
    `SELECT anonymized_text AS "anonymizedText" FROM insight_candidates
     WHERE category=$1 AND status='approved' ORDER BY random() LIMIT $2`,
    [category, limit]
  );
  return rows.map((r) => r.anonymizedText);
}
