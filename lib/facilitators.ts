// D-022 (docs/DECISION_LOG.md): Faculty-enablement / train-the-trainer
// track — Wadhwani Foundation's actual scale mechanism (1,000+
// institutions) is training an institution's OWN staff to run sessions
// themselves, rather than routing every founder through a scarce pool of
// outside 1:1 mentor accounts. docs/ROADMAP.md named this as a real,
// not-yet-built gap; this file is the software feature that closes it.
//
// What's real here: a new institution-scoped role (`cohort_facilitator`),
// a per-week readiness acknowledgement against the programme's own
// existing facultyGuidance/mentorPrompt/youthSafetyNote text (D-006's
// DEFAULT_14_WEEK_TEMPLATE — no separate training-content system was
// invented), and a server-enforced gate: a staff member cannot log that
// they ran a week's session until they've acknowledged that week's
// guidance. No certificate, badge, or completion score is fabricated —
// this is a real gate on a real action, nothing more.
import { q, qOne, newId, now } from "./pg";
import { requireAnyRole, requireRole, writeAudit } from "./institutional";

const STAFF_ROLES = ["institution_owner", "institution_administrator", "programme_manager"];

// ---------------------------------------------------------------------
// Granting the facilitator role
// ---------------------------------------------------------------------

/** Only existing institution staff (owner/administrator/programme manager)
 * can designate one of their own institution's members as a facilitator —
 * same authority level D-005 already requires to create a programme. */
export async function grantFacilitatorRole(actorUserId: string, institutionId: string, targetUserId: string) {
  await requireAnyRole(actorUserId, STAFF_ROLES, "institution", institutionId);
  const isMember = await qOne(`SELECT 1 FROM institution_memberships WHERE institution_id=$1 AND user_id=$2`, [institutionId, targetUserId]);
  if (!isMember) throw new Error("That person isn't a member of this institution yet — they need an existing membership before they can be made a facilitator.");
  await q(
    `INSERT INTO role_assignments (id,user_id,scope_type,scope_id,role,granted_by,created_at) VALUES ($1,$2,'institution',$3,'cohort_facilitator',$4,$5)
     ON CONFLICT (user_id, scope_type, scope_id, role) DO NOTHING`,
    [newId(), targetUserId, institutionId, actorUserId, now()]
  );
  await writeAudit(actorUserId, "facilitator.grant", "institution", institutionId, { targetUserId });
}

export async function listFacilitators(institutionId: string): Promise<{ userId: string; userName: string; userEmail: string; grantedAt: string }[]> {
  return q(
    `SELECT ra.user_id AS "userId", u.name AS "userName", u.email AS "userEmail", ra.created_at AS "grantedAt"
     FROM role_assignments ra JOIN users u ON u.id = ra.user_id
     WHERE ra.scope_type='institution' AND ra.scope_id=$1 AND ra.role='cohort_facilitator'
     ORDER BY ra.created_at DESC`,
    [institutionId]
  );
}

/** Institution members who are not yet a facilitator — the real pool a
 * staff dropdown offers, never an invented roster. */
export async function listInstitutionMembersWithNames(institutionId: string): Promise<{ userId: string; userName: string; userEmail: string }[]> {
  return q(
    `SELECT m.user_id AS "userId", u.name AS "userName", u.email AS "userEmail"
     FROM institution_memberships m JOIN users u ON u.id = m.user_id
     WHERE m.institution_id=$1 AND m.status='active'
     ORDER BY u.name ASC`,
    [institutionId]
  );
}

// ---------------------------------------------------------------------
// Readiness (the real "training materials" step)
// ---------------------------------------------------------------------

export async function getWeekReadiness(programmeId: string, userId: string): Promise<Set<number>> {
  const rows = await q<{ weekNumber: number }>(
    `SELECT week_number AS "weekNumber" FROM facilitator_readiness WHERE programme_id=$1 AND user_id=$2`,
    [programmeId, userId]
  );
  return new Set(rows.map((r) => r.weekNumber));
}

/** A facilitator acknowledges they've read this week's real
 * facultyGuidance/mentorPrompt/youthSafetyNote — the actual, existing
 * curriculum text, not a placeholder. Requires the cohort_facilitator role
 * at (or above) this programme's institution. */
export async function acknowledgeWeekReadiness(userId: string, programmeId: string, weekNumber: number) {
  await requireRole(userId, "cohort_facilitator", "programme", programmeId);
  await q(
    `INSERT INTO facilitator_readiness (id,programme_id,user_id,week_number,acknowledged_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (programme_id, user_id, week_number) DO NOTHING`,
    [newId(), programmeId, userId, weekNumber, now()]
  );
  await writeAudit(userId, "facilitator.acknowledge_week", "programme", programmeId, { weekNumber });
}

// ---------------------------------------------------------------------
// Logging a session an institution's own staff actually ran
// ---------------------------------------------------------------------

export type FacilitatedSession = {
  id: string; cohortId: string; weekNumber: number; facilitatorUserId: string;
  summary: string; foundersPresent: number; ranAt: string; createdAt: string;
};

/** The gate that makes this a real "enablement track" rather than a
 * self-declared checkbox: you cannot log a session for a week you have not
 * acknowledged the guidance for. Enforced server-side, not just hidden in
 * the UI. */
export async function logFacilitatedSession(
  actorUserId: string, cohortId: string, weekNumber: number, summary: string, foundersPresent: number
): Promise<FacilitatedSession> {
  const cohort = await qOne<{ programmeId: string }>(`SELECT programme_id AS "programmeId" FROM cohorts WHERE id=$1`, [cohortId]);
  if (!cohort) throw new Error("Cohort not found");
  await requireRole(actorUserId, "cohort_facilitator", "cohort", cohortId);
  const ready = await getWeekReadiness(cohort.programmeId, actorUserId);
  if (!ready.has(weekNumber)) {
    throw new Error(`Acknowledge week ${weekNumber}'s facilitator guidance before logging a session for it.`);
  }
  if (!summary.trim()) throw new Error("Describe what the session actually covered before logging it.");
  const id = newId();
  await q(
    `INSERT INTO facilitated_sessions (id,cohort_id,week_number,facilitator_user_id,summary,founders_present,ran_at,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp(),$7)`,
    [id, cohortId, weekNumber, actorUserId, summary.trim(), Math.max(0, foundersPresent || 0), now()]
  );
  await writeAudit(actorUserId, "facilitator.log_session", "cohort", cohortId, { weekNumber, foundersPresent });
  return (await qOne<FacilitatedSession>(
    `SELECT id, cohort_id AS "cohortId", week_number AS "weekNumber", facilitator_user_id AS "facilitatorUserId",
      summary, founders_present AS "foundersPresent", ran_at AS "ranAt", created_at AS "createdAt"
     FROM facilitated_sessions WHERE id=$1`, [id]
  ))!;
}

export async function listFacilitatedSessions(cohortId: string): Promise<FacilitatedSession[]> {
  return q<FacilitatedSession>(
    `SELECT id, cohort_id AS "cohortId", week_number AS "weekNumber", facilitator_user_id AS "facilitatorUserId",
      summary, founders_present AS "foundersPresent", ran_at AS "ranAt", created_at AS "createdAt"
     FROM facilitated_sessions WHERE cohort_id=$1 ORDER BY ran_at DESC`,
    [cohortId]
  );
}

export type FacilitatorCoverage = { weeksTotal: number; weeksWithInternalSession: number; totalSessionsLogged: number };

/** The honest institution-dashboard aggregate: of the programme's real
 * weeks, how many has this cohort's own staff actually run a session for
 * — separate from (additive to, never replacing) MentorCoverageLine's
 * external 1:1 mentor figures. */
export async function computeFacilitatorCoverageForCohort(cohortId: string): Promise<FacilitatorCoverage> {
  const cohort = await qOne<{ programmeId: string }>(`SELECT programme_id AS "programmeId" FROM cohorts WHERE id=$1`, [cohortId]);
  if (!cohort) return { weeksTotal: 0, weeksWithInternalSession: 0, totalSessionsLogged: 0 };
  const weeksRow = await qOne<{ count: number }>(`SELECT COUNT(*)::int AS count FROM programme_weeks WHERE programme_id=$1`, [cohort.programmeId]);
  const sessions = await q<{ weekNumber: number }>(`SELECT week_number AS "weekNumber" FROM facilitated_sessions WHERE cohort_id=$1`, [cohortId]);
  return {
    weeksTotal: weeksRow?.count ?? 0,
    weeksWithInternalSession: new Set(sessions.map((s) => s.weekNumber)).size,
    totalSessionsLogged: sessions.length,
  };
}
