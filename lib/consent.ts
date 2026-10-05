// Consent, guardian relationships, and data-subject-rights requests
// (D-010, docs/DECISION_LOG.md) — a real DPDP Act 2023-shaped data layer,
// built free (plain Postgres + the app itself, no paid compliance vendor).
//
// Honesty boundary, stated once here rather than repeated at every call
// site: nothing in this file performs identity verification. A guardian
// relationship is "confirmed" when whoever holds the emailed confirm link
// clicks it — that is what most consumer products mean by "verified
// guardian consent" without a paid ID-check vendor, and this file never
// claims more than that.
import { q, qOne, tx, newId, now } from "./pg";
import crypto from "node:crypto";

export type GuardianRelationship = {
  id: string; explorerUserId: string; guardianName: string; guardianEmail: string;
  guardianPhone: string; relationship: string; status: "pending" | "confirmed" | "revoked";
  createdAt: string; confirmedAt: string | null; revokedAt: string | null;
  /** Only meaningful while status is "pending" — needed to build the
   * confirm link since no email-sending service is wired up yet (see
   * docs/ROADMAP.md); shown to the founder so they can pass it to the
   * guardian themselves. */
  confirmToken: string;
};

export type ConsentRecord = {
  id: string; userId: string; consentType: string; granted: boolean;
  grantedBy: "self" | "guardian"; note: string; createdAt: string;
};

export type DataRequest = {
  id: string; userId: string; requestType: "export" | "deletion";
  status: "pending" | "completed"; note: string; createdAt: string; completedAt: string | null;
};

const GUARDIAN_COLS = `
  id, explorer_user_id AS "explorerUserId", guardian_name AS "guardianName",
  guardian_email AS "guardianEmail", guardian_phone AS "guardianPhone", relationship, status,
  created_at::text AS "createdAt", confirmed_at::text AS "confirmedAt", revoked_at::text AS "revokedAt",
  confirm_token AS "confirmToken"
`;

const CONSENT_COLS = `
  id, user_id AS "userId", consent_type AS "consentType", granted, granted_by AS "grantedBy",
  note, created_at::text AS "createdAt"
`;

const REQUEST_COLS = `
  id, user_id AS "userId", request_type AS "requestType", status, note,
  created_at::text AS "createdAt", completed_at::text AS "completedAt"
`;

// ---------------------------------------------------------------------
// Guardian relationships (explorer accounts, ages 13-17)
// ---------------------------------------------------------------------

export async function addGuardianRelationship(
  explorerUserId: string,
  input: { guardianName: string; guardianEmail: string; guardianPhone?: string; relationship?: string }
): Promise<{ relationship: GuardianRelationship; confirmToken: string }> {
  const name = input.guardianName.trim();
  const email = input.guardianEmail.trim().toLowerCase();
  if (!name) throw new Error("Guardian name is required");
  if (!email || !email.includes("@")) throw new Error("A valid guardian email is required");

  const id = newId();
  const confirmToken = crypto.randomBytes(24).toString("hex");
  await q(
    `INSERT INTO guardian_relationships
       (id, explorer_user_id, guardian_name, guardian_email, guardian_phone, relationship, status, confirm_token, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)`,
    [id, explorerUserId, name, email, input.guardianPhone ?? "", input.relationship ?? "parent/guardian", confirmToken, now()]
  );
  const row = await qOne<GuardianRelationship>(`SELECT ${GUARDIAN_COLS} FROM guardian_relationships WHERE id=$1`, [id]);
  return { relationship: row as GuardianRelationship, confirmToken };
}

export async function listGuardianRelationships(explorerUserId: string): Promise<GuardianRelationship[]> {
  return q<GuardianRelationship>(
    `SELECT ${GUARDIAN_COLS} FROM guardian_relationships WHERE explorer_user_id=$1 ORDER BY created_at DESC`,
    [explorerUserId]
  );
}

/** Called from the link the guardian receives by email — no login required,
 * matching how most consumer double opt-in flows work. Also writes the
 * canonical consent_records row so the consent trail is queryable in one
 * place regardless of how it was granted. */
export async function confirmGuardianRelationship(relationshipId: string, confirmToken: string): Promise<GuardianRelationship> {
  const rel = await qOne<{ id: string; explorerUserId: string; confirmToken: string; status: string }>(
    `SELECT id, explorer_user_id AS "explorerUserId", confirm_token AS "confirmToken", status FROM guardian_relationships WHERE id=$1`,
    [relationshipId]
  );
  if (!rel) throw new Error("Guardian relationship not found");
  if (rel.confirmToken !== confirmToken) throw new Error("Invalid confirmation link");
  if (rel.status === "revoked") throw new Error("This guardian relationship was revoked");

  await tx(async (client) => {
    await client.query(`UPDATE guardian_relationships SET status='confirmed', confirmed_at=$2 WHERE id=$1`, [relationshipId, now()]);
    await client.query(
      `INSERT INTO consent_records (id, user_id, consent_type, granted, granted_by, granted_by_relationship_id, note, created_at)
       VALUES ($1,$2,'guardian_consent',true,'guardian',$3,'Confirmed via emailed guardian link',$4)`,
      [newId(), rel.explorerUserId, relationshipId, now()]
    );
  });

  const updated = await qOne<GuardianRelationship>(`SELECT ${GUARDIAN_COLS} FROM guardian_relationships WHERE id=$1`, [relationshipId]);
  return updated as GuardianRelationship;
}

export async function revokeGuardianRelationship(relationshipId: string): Promise<void> {
  const rel = await qOne<{ explorerUserId: string }>(
    `SELECT explorer_user_id AS "explorerUserId" FROM guardian_relationships WHERE id=$1`, [relationshipId]
  );
  if (!rel) throw new Error("Guardian relationship not found");
  await tx(async (client) => {
    await client.query(`UPDATE guardian_relationships SET status='revoked', revoked_at=$2 WHERE id=$1`, [relationshipId, now()]);
    await client.query(
      `INSERT INTO consent_records (id, user_id, consent_type, granted, granted_by, granted_by_relationship_id, note, created_at)
       VALUES ($1,$2,'guardian_consent',false,'guardian',$3,'Guardian relationship revoked',$4)`,
      [newId(), rel.explorerUserId, relationshipId, now()]
    );
  });
}

/** Gate for any future feature that needs confirmed guardian consent before
 * it's available to an explorer account (e.g. unsupervised messaging). Not
 * yet wired into existing founder-lab code — see docs/DECISION_LOG.md D-010
 * "what was deliberately not wired up yet". */
export async function hasConfirmedGuardianConsent(explorerUserId: string): Promise<boolean> {
  const row = await qOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM guardian_relationships WHERE explorer_user_id=$1 AND status='confirmed'`,
    [explorerUserId]
  );
  return (row?.count ?? 0) > 0;
}

// ---------------------------------------------------------------------
// Consent records
// ---------------------------------------------------------------------

export async function recordConsent(
  userId: string,
  consentType: string,
  granted: boolean,
  grantedBy: "self" | "guardian" = "self",
  note = ""
): Promise<ConsentRecord> {
  const id = newId();
  // Uses the database's own clock_timestamp() rather than a JS-computed
  // now() passed as a parameter: getConsentStatus below picks the latest
  // row per consent_type via `ORDER BY created_at DESC`, and a founder
  // can realistically flip the same consent_type more than once in quick
  // succession (D-010's own test does exactly that). JS's Date has only
  // millisecond resolution, so two calls in the same millisecond could
  // tie and make "latest" ambiguous; clock_timestamp() is evaluated fresh
  // per statement at microsecond resolution, so sequential inserts get
  // distinct, correctly-ordered timestamps.
  await q(
    `INSERT INTO consent_records (id, user_id, consent_type, granted, granted_by, note, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp())`,
    [id, userId, consentType, granted, grantedBy, note]
  );
  const row = await qOne<ConsentRecord>(`SELECT ${CONSENT_COLS} FROM consent_records WHERE id=$1`, [id]);
  return row as ConsentRecord;
}

/** Latest decision per consent_type — the append-only log collapsed to
 * current state, the way a consent trail is meant to be read. */
export async function getConsentStatus(userId: string): Promise<Record<string, ConsentRecord>> {
  const rows = await q<ConsentRecord>(
    `SELECT DISTINCT ON (consent_type) ${CONSENT_COLS}
     FROM consent_records WHERE user_id=$1 ORDER BY consent_type, created_at DESC`,
    [userId]
  );
  const out: Record<string, ConsentRecord> = {};
  for (const r of rows) out[r.consentType] = r;
  return out;
}

export async function listConsentHistory(userId: string): Promise<ConsentRecord[]> {
  return q<ConsentRecord>(`SELECT ${CONSENT_COLS} FROM consent_records WHERE user_id=$1 ORDER BY created_at DESC`, [userId]);
}

// ---------------------------------------------------------------------
// Data-subject-rights requests (access/export, erasure)
// ---------------------------------------------------------------------

export async function requestDataAction(userId: string, requestType: "export" | "deletion", note = ""): Promise<DataRequest> {
  const id = newId();
  await q(
    `INSERT INTO data_requests (id, user_id, request_type, status, note, created_at) VALUES ($1,$2,$3,'pending',$4,$5)`,
    [id, userId, requestType, note, now()]
  );
  const row = await qOne<DataRequest>(`SELECT ${REQUEST_COLS} FROM data_requests WHERE id=$1`, [id]);
  return row as DataRequest;
}

export async function listDataRequests(userId: string): Promise<DataRequest[]> {
  return q<DataRequest>(`SELECT ${REQUEST_COLS} FROM data_requests WHERE user_id=$1 ORDER BY created_at DESC`, [userId]);
}

/** Real, live "right to access" export — every table where a founder owns
 * rows, queried directly (no cached/derived copy), password hash always
 * excluded. Marks the originating request (if any) completed. */
const EXPORT_TABLES: Array<{ table: string; label: string }> = [
  { table: "founder_profiles", label: "Self Discovery profile" },
  { table: "opportunities", label: "Opportunity Forest entries" },
  { table: "experiments", label: "Validation Quest Lab experiments" },
  { table: "evidence_items", label: "Evidence Lab items" },
  { table: "risks", label: "Risks" },
  { table: "financial_scenarios", label: "Money Lab scenarios" },
  { table: "activity_log", label: "Activity log" },
  { table: "comparable_companies", label: "Comparable Businesses" },
  { table: "ecosystem_contacts", label: "Investor Ecosystem contacts" },
  { table: "business_plan", label: "Business Plan" },
  { table: "actuals_log", label: "Actuals log" },
  { table: "dpr_inputs", label: "India Ledger DPR inputs" },
  { table: "mentor_profiles", label: "Mentor profile" },
];

export async function exportUserData(userId: string, requestId?: string): Promise<Record<string, unknown>> {
  const user = await qOne<{ id: string; name: string; email: string; ageBand: string; createdAt: string }>(
    `SELECT id, name, email, age_band AS "ageBand", created_at::text AS "createdAt" FROM users WHERE id=$1`,
    [userId]
  );
  if (!user) throw new Error("User not found");

  const data: Record<string, unknown> = { account: user };
  for (const { table, label } of EXPORT_TABLES) {
    try {
      data[label] = await q(`SELECT * FROM ${table} WHERE user_id=$1`, [userId]);
    } catch {
      // Table doesn't exist in this schema version yet — skip rather than
      // fail the whole export over one table.
    }
  }
  data["Guardian relationships"] = await listGuardianRelationships(userId);
  data["Consent history"] = await listConsentHistory(userId);
  data["Mentorship requests (as founder)"] = await q(
    `SELECT * FROM mentorship_requests WHERE founder_user_id=$1`, [userId]
  ).catch(() => []);

  if (requestId) {
    await q(`UPDATE data_requests SET status='completed', completed_at=$2 WHERE id=$1`, [requestId, now()]);
  }
  return data;
}

/** Erasure of the founder's own personal data. Deliberately NOT called
 * automatically when a deletion request is filed (see migration comment
 * and D-010) — a human confirms, then this runs in one transaction.
 * Institutional/audit rows that reference the user (audit_events,
 * evaluations, role_assignments) are intentionally left in place with the
 * user_id as the only remaining reference, matching common DPDP practice
 * of retaining minimal records needed for legal/audit obligations rather
 * than cascading erasure into another party's compliance records. */
export async function executeDataDeletion(userId: string, requestId: string): Promise<void> {
  await tx(async (client) => {
    for (const { table } of EXPORT_TABLES) {
      try {
        await client.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId]);
      } catch {
        // see exportUserData — same tolerant skip
      }
    }
    await client.query(`DELETE FROM guardian_relationships WHERE explorer_user_id=$1`, [userId]);
    await client.query(
      `UPDATE users SET name='Deleted user', email=$2, password_hash='deleted' WHERE id=$1`,
      [userId, `deleted-${userId}@example.invalid`]
    );
    await client.query(`UPDATE data_requests SET status='completed', completed_at=$2 WHERE id=$1`, [requestId, now()]);
  });
}
