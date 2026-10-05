// Mentor Discovery & Matching — see docs/DECISION_LOG.md D-008 and D-009.
//
// Three real reference patterns, combined without copying any platform's
// branding or content:
//   Wadhwani Foundation style — a mentor is a structured profile (not a
//   name in a spreadsheet), every conversation is a logged session with a
//   summary and next steps, and (D-009) a relationship carries a
//   Growth-Advisor-style shared next-check-in date, flagged when overdue —
//   the same "structured cadence" idea behind Wadhwani's stated 9-month
//   Accelerate check-in, generalized to any accepted mentorship.
//   MAARG (Startup India) style — founders discover mentors through a
//   ranked match list built from real overlap between the founder's own
//   Self Discovery categories / active Opportunity Card sector and each
//   mentor's stated expertise, then send a structured request the mentor
//   accepts or declines. MAARG's own materials describe its matching as
//   "AI/ML-powered" without publishing the model; here the ranking factors
//   are disclosed (D-009 adds real available-capacity to the score, not
//   just tag overlap) and a mentor at capacity cannot be over-committed —
//   the founder-facing "meeting scheduler" idea becomes the same shared
//   next-check-in date used for the Wadhwani-style cadence above.
//   YUKTI/IIC style — an institution gets a live, aggregate view of real
//   activity for its own cohorts (D-009's `computeMentorshipCoverage`),
//   the same "institutional reporting layer" role YUKTI plays for MIC,
//   without claiming any connection to a government ranking.
//
// No mentor profile, request, or session here is ever fabricated — a
// founder only sees mentors that a real account holder created, a match
// score is only ever computed from real stored text, and no AI or admin
// assigns a mentor top-down.
import { q, qOne, newId, now } from "./pg";
import { writeAudit } from "./institutional";
import { hasConfirmedGuardianConsent } from "./consent";

export type MentorProfile = {
  id: string; userId: string; institutionId: string | null; headline: string; bio: string;
  expertiseTags: string; sectors: string; mentorshipMode: string; languages: string;
  capacityPerMonth: number; status: string; createdAt: string; updatedAt: string;
  /** D-013: self-attestation, never a real credentialing process — see
   * the migration comment and docs/DECISION_LOG.md. Always shown to
   * founders labelled "self-declared, not verified by Z Cubs". */
  credentialsNote: string;
  attestationConfirmed: boolean;
  attestedAt: string | null;
  referenceName: string;
  referenceEmail: string;
  referenceRelationship: string;
};

export type MentorshipRequest = {
  id: string; founderUserId: string; mentorUserId: string; focusArea: string; message: string;
  status: string; declineNote: string; requestedAt: string; respondedAt: string | null;
  nextCheckinAt: string | null;
};

export type MentorshipSession = {
  id: string; requestId: string; loggedByUserId: string; sessionDate: string; summary: string;
  nextSteps: string; createdAt: string;
};

const MENTOR_COLS = `id, user_id AS "userId", institution_id AS "institutionId", headline, bio,
  expertise_tags AS "expertiseTags", sectors, mentorship_mode AS "mentorshipMode", languages,
  capacity_per_month AS "capacityPerMonth", status, created_at AS "createdAt", updated_at AS "updatedAt",
  credentials_note AS "credentialsNote", attestation_confirmed AS "attestationConfirmed",
  attested_at::text AS "attestedAt", reference_name AS "referenceName", reference_email AS "referenceEmail",
  reference_relationship AS "referenceRelationship"`;

function splitTags(text: string): string[] {
  return text.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
}

// ---------------------------------------------------------------------
// Mentor profiles — becoming a mentor is opening this profile, same as
// any other account can become an institution owner. Real accounts only.
// ---------------------------------------------------------------------

export async function upsertMentorProfile(userId: string, input: {
  headline: string; bio: string; expertiseTags: string; sectors: string;
  mentorshipMode: string; languages: string; capacityPerMonth: number;
  credentialsNote: string; attestationConfirmed: boolean;
  referenceName?: string; referenceEmail?: string; referenceRelationship?: string;
}): Promise<MentorProfile> {
  // D-013: real, minimal gating — closes "requires nothing beyond an
  // account" without pretending to run a background check. Every save
  // (create or edit) re-confirms the attestation; attested_at always
  // reflects the most recent save, not just the first one.
  if (!input.credentialsNote.trim()) {
    throw new Error("Describe what qualifies you to mentor (experience, role, what you can help with) before saving your mentor profile.");
  }
  if (!input.attestationConfirmed) {
    throw new Error("You must confirm the attestation checkbox — that what you've written is accurate — before saving your mentor profile.");
  }
  const referenceName = input.referenceName ?? "";
  const referenceEmail = input.referenceEmail ?? "";
  const referenceRelationship = input.referenceRelationship ?? "";
  const existing = await getMentorProfileByUser(userId);
  if (existing) {
    return qOne<MentorProfile>(
      `UPDATE mentor_profiles SET headline=$2, bio=$3, expertise_tags=$4, sectors=$5,
       mentorship_mode=$6, languages=$7, capacity_per_month=$8, updated_at=$9,
       credentials_note=$10, attestation_confirmed=true, attested_at=$9,
       reference_name=$11, reference_email=$12, reference_relationship=$13
       WHERE user_id=$1 RETURNING ${MENTOR_COLS}`,
      [userId, input.headline, input.bio, input.expertiseTags, input.sectors, input.mentorshipMode, input.languages, input.capacityPerMonth, now(),
        input.credentialsNote, referenceName, referenceEmail, referenceRelationship]
    ) as Promise<MentorProfile>;
  }
  const id = newId();
  await q(
    `INSERT INTO mentor_profiles (id, user_id, headline, bio, expertise_tags, sectors, mentorship_mode, languages, capacity_per_month, status,
       credentials_note, attestation_confirmed, attested_at, reference_name, reference_email, reference_relationship, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,true,$11,$12,$13,$14,$11,$11)`,
    [id, userId, input.headline, input.bio, input.expertiseTags, input.sectors, input.mentorshipMode, input.languages, input.capacityPerMonth,
      input.credentialsNote, now(), referenceName, referenceEmail, referenceRelationship]
  );
  await writeAudit(userId, "mentor.profile_create", "platform", "", { userId });
  return getMentorProfileByUser(userId) as Promise<MentorProfile>;
}

export async function getMentorProfileByUser(userId: string): Promise<MentorProfile | undefined> {
  return (await qOne<MentorProfile>(`SELECT ${MENTOR_COLS} FROM mentor_profiles WHERE user_id=$1`, [userId])) ?? undefined;
}

export async function setMentorStatus(userId: string, status: "active" | "paused") {
  await q(`UPDATE mentor_profiles SET status=$2, updated_at=$3 WHERE user_id=$1`, [userId, status, now()]);
}

// NOTE: fully-qualified, explicitly-written column list for this JOIN query
// — never programmatically prefix MENTOR_COLS with a table alias here (a
// prior bug in this codebase showed that splitting a multi-line column
// constant on ", " silently mismatches on line-wrapped commas and produces
// ambiguous-column SQL; see docs/DECISION_LOG.md).
//
// activeMenteeCount is a real, live COUNT of that mentor's currently
// "accepted" (not yet completed) requests — the input to D-009's
// capacity-aware ranking and acceptance gate below. Never a fabricated
// availability score.
export async function listActiveMentors(excludeUserId?: string): Promise<(MentorProfile & { name: string; institutionName: string | null; activeMenteeCount: number })[]> {
  const rows = await q<MentorProfile & { name: string; institutionName: string | null; activeMenteeCount: number }>(
    `SELECT mp.id, mp.user_id AS "userId", mp.institution_id AS "institutionId", mp.headline, mp.bio,
            mp.expertise_tags AS "expertiseTags", mp.sectors, mp.mentorship_mode AS "mentorshipMode",
            mp.languages, mp.capacity_per_month AS "capacityPerMonth", mp.status,
            mp.created_at AS "createdAt", mp.updated_at AS "updatedAt",
            mp.credentials_note AS "credentialsNote", mp.attestation_confirmed AS "attestationConfirmed",
            mp.attested_at::text AS "attestedAt", mp.reference_name AS "referenceName",
            mp.reference_email AS "referenceEmail", mp.reference_relationship AS "referenceRelationship",
            u.name AS name, i.name AS "institutionName",
            COALESCE((SELECT COUNT(*) FROM mentorship_requests mr WHERE mr.mentor_user_id = mp.user_id AND mr.status = 'accepted'), 0)::int AS "activeMenteeCount"
     FROM mentor_profiles mp
     JOIN users u ON u.id = mp.user_id
     LEFT JOIN institutions i ON i.id = mp.institution_id
     WHERE mp.status = 'active' ${excludeUserId ? "AND mp.user_id <> $1" : ""}
     ORDER BY mp.updated_at DESC`,
    excludeUserId ? [excludeUserId] : []
  );
  return rows;
}

// ---------------------------------------------------------------------
// MAARG-style ranked matching (D-008), deepened in D-009 with a second,
// disclosed factor: real available capacity, not tag overlap alone. A
// mentor already at capacity is never hidden — a founder can still see
// and message them — but is ranked below an equally-relevant mentor with
// room, and cannot be accepted into over-commitment (see respondToRequest).
// Every number here is computed live; nothing is a fabricated "AI score".
// ---------------------------------------------------------------------

export type MentorMatch = {
  mentor: MentorProfile & { name: string; institutionName: string | null; activeMenteeCount: number };
  overlapTags: string[];
  score: number;
  atCapacity: boolean;
};

export async function matchMentorsForFounder(founderUserId: string): Promise<MentorMatch[]> {
  const profile = await qOne<{ categories: string }>(`SELECT categories FROM founder_profiles WHERE user_id=$1`, [founderUserId]);
  const opportunitySectors = await q<{ mission: string }>(
    `SELECT mission FROM opportunities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`, [founderUserId]
  );
  const founderTags = new Set<string>([
    ...(profile ? splitTags(profile.categories) : []),
    ...opportunitySectors.flatMap((o) => splitTags(o.mission)),
  ]);
  const mentors = await listActiveMentors(founderUserId);
  const matches: MentorMatch[] = mentors.map((mentor) => {
    const mentorTags = new Set([...splitTags(mentor.expertiseTags), ...splitTags(mentor.sectors)]);
    const overlapTags = [...founderTags].filter((t) => [...mentorTags].some((m) => m.includes(t) || t.includes(m)));
    const atCapacity = mentor.activeMenteeCount >= mentor.capacityPerMonth;
    return { mentor, overlapTags, score: overlapTags.length, atCapacity };
  });
  // Ranking: real tag overlap first (most relevant), then real availability
  // (mentors with headroom before mentors at capacity), then alphabetical.
  // Nothing here is hidden — atCapacity and activeMenteeCount are shown to
  // the founder so the ranking is inspectable, not opaque like an "AI/ML"
  // black box.
  return matches.sort((a, b) =>
    b.score - a.score ||
    Number(a.atCapacity) - Number(b.atCapacity) ||
    a.mentor.name.localeCompare(b.mentor.name)
  );
}

// ---------------------------------------------------------------------
// Requests — founder-initiated, mentor accepts/declines. Structured, not
// a chat thread, per the Wadhwani-style "logged relationship" pattern.
// ---------------------------------------------------------------------

export async function requestMentorship(founderUserId: string, mentorUserId: string, focusArea: string, message: string): Promise<MentorshipRequest> {
  if (founderUserId === mentorUserId) throw new Error("You can't request mentorship from yourself.");
  // D-012 (docs/DECISION_LOG.md): a mentor is an adult with nothing more
  // than a Z Cubs account — no vetting beyond self-attestation (D-009/
  // D-012). For an Explorer (13-17) founder, that's real adult-minor
  // contact, so it's gated on a confirmed guardian the same way a risky
  // real-world experiment is. Nothing else about the platform is gated by
  // this — an Explorer can still browse and message no one.
  const founder = await qOne<{ ageBand: string }>(`SELECT age_band AS "ageBand" FROM users WHERE id=$1`, [founderUserId]);
  if (founder?.ageBand === "explorer" && !(await hasConfirmedGuardianConsent(founderUserId))) {
    throw new Error(
      "Explorer accounts need a confirmed guardian (Privacy & Consent page) before messaging a mentor — mentors are adults verified only by their own account, nothing more."
    );
  }
  const id = newId();
  await q(
    `INSERT INTO mentorship_requests (id, founder_user_id, mentor_user_id, focus_area, message, status, requested_at)
     VALUES ($1,$2,$3,$4,$5,'requested',$6)`,
    [id, founderUserId, mentorUserId, focusArea, message, now()]
  );
  await writeAudit(founderUserId, "mentorship.request", "platform", "", { mentorUserId, focusArea });
  return qOne<MentorshipRequest>(
    `SELECT id, founder_user_id AS "founderUserId", mentor_user_id AS "mentorUserId", focus_area AS "focusArea",
            message, status, decline_note AS "declineNote", requested_at AS "requestedAt", responded_at AS "respondedAt",
            next_checkin_at::text AS "nextCheckinAt"
     FROM mentorship_requests WHERE id=$1`,
    [id]
  ) as Promise<MentorshipRequest>;
}

export async function respondToRequest(mentorUserId: string, requestId: string, accept: boolean, declineNote = "") {
  const request = await qOne<{ mentorUserId: string }>(`SELECT mentor_user_id AS "mentorUserId" FROM mentorship_requests WHERE id=$1`, [requestId]);
  if (!request || request.mentorUserId !== mentorUserId) throw new Error("Not your request to respond to.");
  if (accept) {
    // D-009 capacity gate: a mentor cannot accept past their own stated
    // capacity_per_month — the "performance monitoring" idea from MAARG's
    // feature list, made into a real, enforced check rather than a
    // stored-but-ignored number.
    const profile = await getMentorProfileByUser(mentorUserId);
    const activeCount = (await qOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM mentorship_requests WHERE mentor_user_id=$1 AND status='accepted'`, [mentorUserId]
    ))?.count ?? 0;
    if (profile && activeCount >= profile.capacityPerMonth) {
      throw new Error(`You're at your stated capacity (${profile.capacityPerMonth} active mentees) — raise it in your profile, or complete an existing mentorship first.`);
    }
  }
  await q(
    `UPDATE mentorship_requests SET status=$2, decline_note=$3, responded_at=$4 WHERE id=$1`,
    [requestId, accept ? "accepted" : "declined", declineNote, now()]
  );
  await writeAudit(mentorUserId, accept ? "mentorship.accept" : "mentorship.decline", "platform", "", { requestId });
}

// D-009: a shared "next check-in" date — the same field serves both
// MAARG's stated meeting-scheduler feature and Wadhwani's structured
// check-in cadence (its Accelerate programme's 9-month milestone check-in,
// generalized here to any accepted relationship). Either participant can
// set it; it's just a date, not a real calendar/video integration — never
// presented as more than that.
export async function setNextCheckin(userId: string, requestId: string, date: string | null) {
  const request = await qOne<{ founderUserId: string; mentorUserId: string }>(
    `SELECT founder_user_id AS "founderUserId", mentor_user_id AS "mentorUserId" FROM mentorship_requests WHERE id=$1`, [requestId]
  );
  if (!request || (request.founderUserId !== userId && request.mentorUserId !== userId)) throw new Error("Not part of this mentorship.");
  await q(`UPDATE mentorship_requests SET next_checkin_at=$2 WHERE id=$1`, [requestId, date]);
  await writeAudit(userId, "mentorship.checkin_set", "platform", "", { requestId, date });
}

export async function markRequestCompleted(userId: string, requestId: string) {
  await q(
    `UPDATE mentorship_requests SET status='completed', responded_at=$2
     WHERE id=$1 AND (founder_user_id=$3 OR mentor_user_id=$3)`,
    [requestId, now(), userId]
  );
}

const REQUEST_COLS = `r.id, r.founder_user_id AS "founderUserId", r.mentor_user_id AS "mentorUserId",
  r.focus_area AS "focusArea", r.message, r.status, r.decline_note AS "declineNote",
  r.requested_at AS "requestedAt", r.responded_at AS "respondedAt", r.next_checkin_at::text AS "nextCheckinAt"`;

export async function listRequestsForFounder(founderUserId: string) {
  return q<MentorshipRequest & { mentorName: string }>(
    `SELECT ${REQUEST_COLS}, u.name AS "mentorName"
     FROM mentorship_requests r JOIN users u ON u.id = r.mentor_user_id
     WHERE r.founder_user_id=$1 ORDER BY r.requested_at DESC`,
    [founderUserId]
  );
}

export async function listRequestsForMentor(mentorUserId: string) {
  return q<MentorshipRequest & { founderName: string }>(
    `SELECT ${REQUEST_COLS}, u.name AS "founderName"
     FROM mentorship_requests r JOIN users u ON u.id = r.founder_user_id
     WHERE r.mentor_user_id=$1 ORDER BY r.requested_at DESC`,
    [mentorUserId]
  );
}

// ---------------------------------------------------------------------
// Sessions — the structured log; either side can add an entry.
// ---------------------------------------------------------------------

export async function logSession(userId: string, requestId: string, sessionDate: string, summary: string, nextSteps: string): Promise<MentorshipSession> {
  const request = await qOne<{ founderUserId: string; mentorUserId: string }>(
    `SELECT founder_user_id AS "founderUserId", mentor_user_id AS "mentorUserId" FROM mentorship_requests WHERE id=$1`, [requestId]
  );
  if (!request || (request.founderUserId !== userId && request.mentorUserId !== userId)) throw new Error("Not part of this mentorship.");
  const id = newId();
  await q(
    `INSERT INTO mentorship_sessions (id, request_id, logged_by_user_id, session_date, summary, next_steps, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, requestId, userId, sessionDate, summary, nextSteps, now()]
  );
  await writeAudit(userId, "mentorship.session_log", "platform", "", { requestId });
  return qOne<MentorshipSession>(
    `SELECT id, request_id AS "requestId", logged_by_user_id AS "loggedByUserId", session_date::text AS "sessionDate",
            summary, next_steps AS "nextSteps", created_at AS "createdAt" FROM mentorship_sessions WHERE id=$1`,
    [id]
  ) as Promise<MentorshipSession>;
}

export async function listSessionsForRequest(requestId: string): Promise<(MentorshipSession & { loggedByName: string })[]> {
  return q<MentorshipSession & { loggedByName: string }>(
    `SELECT s.id, s.request_id AS "requestId", s.logged_by_user_id AS "loggedByUserId", s.session_date::text AS "sessionDate",
            s.summary, s.next_steps AS "nextSteps", s.created_at AS "createdAt", u.name AS "loggedByName"
     FROM mentorship_sessions s JOIN users u ON u.id = s.logged_by_user_id
     WHERE s.request_id=$1 ORDER BY s.session_date DESC`,
    [requestId]
  );
}

// ---------------------------------------------------------------------
// YUKTI/IIC-style institutional reporting layer (D-009): a live, honest
// aggregate of real mentorship activity for a cohort's own founders —
// the same "give the institution a real signal" role YUKTI plays for MIC,
// scoped to what this app actually has and never claiming any connection
// to a government ranking. Every figure here is a live COUNT/AVG, not an
// opaque "readiness" number.
// ---------------------------------------------------------------------

export type MentorshipCoverage = {
  founderCount: number;
  foundersWithActiveOrCompletedMentor: number;
  totalSessionsLogged: number;
  overdueCheckins: number;
};

export async function computeMentorshipCoverageForCohort(cohortId: string): Promise<MentorshipCoverage> {
  const founders = await q<{ userId: string }>(`SELECT user_id AS "userId" FROM cohort_memberships WHERE cohort_id=$1`, [cohortId]);
  const founderIds = founders.map((f) => f.userId);
  if (founderIds.length === 0) return { founderCount: 0, foundersWithActiveOrCompletedMentor: 0, totalSessionsLogged: 0, overdueCheckins: 0 };

  const placeholders = founderIds.map((_, i) => `$${i + 1}`).join(",");
  const withMentor = await qOne<{ count: number }>(
    `SELECT COUNT(DISTINCT founder_user_id)::int AS count FROM mentorship_requests
     WHERE founder_user_id IN (${placeholders}) AND status IN ('accepted','completed')`,
    founderIds
  );
  const sessionsRow = await qOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM mentorship_sessions ms
     JOIN mentorship_requests mr ON mr.id = ms.request_id
     WHERE mr.founder_user_id IN (${placeholders})`,
    founderIds
  );
  const overdueRow = await qOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM mentorship_requests
     WHERE founder_user_id IN (${placeholders}) AND status='accepted' AND next_checkin_at IS NOT NULL AND next_checkin_at < CURRENT_DATE`,
    founderIds
  );
  return {
    founderCount: founderIds.length,
    foundersWithActiveOrCompletedMentor: withMentor?.count ?? 0,
    totalSessionsLogged: sessionsRow?.count ?? 0,
    overdueCheckins: overdueRow?.count ?? 0,
  };
}
