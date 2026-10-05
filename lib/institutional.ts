// Institutional layer: tenancy hierarchy, RBAC, Programme Builder, cohorts,
// applications and evaluation. See docs/DECISION_LOG.md D-004/D-005/D-006.
//
// This is genuinely new functionality with no pre-existing call sites, so
// (unlike repo.ts) there was no legacy synchronous API to preserve — every
// function here is async Postgres from the start.
import { q, qOne, tx, newId, now } from "./pg";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type Institution = {
  id: string; name: string; legalName: string; institutionType: string; identifier: string;
  state: string; district: string; contactEmail: string; ageGroupsServed: string;
  preferredLanguage: string; timeZone: string; status: string; governmentOrgId: string | null;
  brandingJson: string; createdAt: string; updatedAt: string;
};

export type Programme = {
  id: string; institutionId: string; title: string; description: string; programmeType: string;
  ageGroup: string; eligibilityNote: string; geography: string; sectorFocus: string;
  startDate: string | null; endDate: string | null; applicationOpensAt: string | null; applicationClosesAt: string | null;
  cohortSizeTarget: number | null; deliveryMode: string; status: string; visibility: string;
  dataRetentionNote: string; isDemonstration: boolean; createdAt: string; updatedAt: string;
};

export type ProgrammeWeek = {
  id: string; programmeId: string; weekNumber: number; title: string; learningObjective: string;
  activitySummary: string; founderDeliverable: string; facultyGuidance: string; mentorPrompt: string;
  evidenceRequirement: string; reflectionQuestion: string; youthSafetyNote: string; deadline: string | null;
};

export type Cohort = {
  id: string; programmeId: string; name: string; status: string; startDate: string | null;
  endDate: string | null; isDemonstration: boolean; createdAt: string;
};

export type CohortMembership = { id: string; cohortId: string; userId: string; roleInCohort: string; status: string; joinedAt: string };

export type Application = {
  id: string; formId: string; applicantUserId: string; answersJson: string; status: string; submittedAt: string | null; createdAt: string;
};

export type Evaluation = { id: string; applicationId: string; evaluatorUserId: string; reasoning: string; status: string };

export type EvaluationRubric = { id: string; programmeId: string; isBlindReview: boolean; createdAt: string };
export type EvaluationCriterion = { id: string; rubricId: string; label: string; weight: number; kind: string; order: number };
export type EvaluationWithScores = {
  id: string; applicationId: string; evaluatorUserId: string; reasoning: string; status: string; submittedAt: string | null;
  scores: { criterionId: string; label: string; weight: number; score: number }[];
  /** Weighted average across whatever criteria this evaluator actually
   * scored — null (never 0 or a fabricated number) when nothing was
   * scored, e.g. an evaluator who only left free-text reasoning. */
  weightedTotal: number | null;
};

// ---------------------------------------------------------------------
// RBAC (D-005) — one table, walked from narrow scope to broad.
// ---------------------------------------------------------------------

export type ScopeType = "platform" | "government_org" | "institution" | "programme" | "cohort";

export async function grantRole(userId: string, scopeType: ScopeType, scopeId: string, role: string, grantedBy = "") {
  await q(
    `INSERT INTO role_assignments (id,user_id,scope_type,scope_id,role,granted_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, scope_type, scope_id, role) DO NOTHING`,
    [newId(), userId, scopeType, scopeId, role, grantedBy, now()]
  );
  await writeAudit(grantedBy || userId, "role.grant", scopeType, scopeId, { userId, role });
}

/**
 * Does `userId` hold `role` at `scopeType`/`scopeId`, or at a broader scope
 * that covers it? Walks: cohort -> programme -> institution -> government
 * org -> platform. Requires the actual parent-chain lookups (not just
 * "any role anywhere") so an institution admin at Institution A does NOT
 * get access to Institution B's programmes.
 */
export async function hasRole(userId: string, role: string, scopeType: ScopeType, scopeId: string): Promise<boolean> {
  const chain = await scopeChain(scopeType, scopeId);
  for (const link of chain) {
    const row = await qOne(`SELECT 1 FROM role_assignments WHERE user_id=$1 AND scope_type=$2 AND scope_id=$3 AND role=$4`, [userId, link.scopeType, link.scopeId, role]);
    if (row) return true;
  }
  return false;
}

async function scopeChain(scopeType: ScopeType, scopeId: string): Promise<{ scopeType: ScopeType; scopeId: string }[]> {
  const chain: { scopeType: ScopeType; scopeId: string }[] = [{ scopeType, scopeId }];
  if (scopeType === "cohort") {
    const cohort = await qOne<{ programmeId: string }>(`SELECT programme_id AS "programmeId" FROM cohorts WHERE id=$1`, [scopeId]);
    if (cohort) chain.push(...(await scopeChain("programme", cohort.programmeId)));
  } else if (scopeType === "programme") {
    const programme = await qOne<{ institutionId: string }>(`SELECT institution_id AS "institutionId" FROM programmes WHERE id=$1`, [scopeId]);
    if (programme) chain.push(...(await scopeChain("institution", programme.institutionId)));
  } else if (scopeType === "institution") {
    const inst = await qOne<{ governmentOrgId: string | null }>(`SELECT government_org_id AS "governmentOrgId" FROM institutions WHERE id=$1`, [scopeId]);
    if (inst?.governmentOrgId) chain.push(...(await scopeChain("government_org", inst.governmentOrgId)));
    chain.push({ scopeType: "platform", scopeId: "platform" });
  } else if (scopeType === "government_org") {
    chain.push({ scopeType: "platform", scopeId: "platform" });
  }
  return chain;
}

/** Throws if the user does not hold the role at/above this scope. Use in every server action/route that touches institutional data. */
export async function requireRole(userId: string, role: string, scopeType: ScopeType, scopeId: string) {
  const ok = await hasRole(userId, role, scopeType, scopeId);
  if (!ok) throw new Error(`Forbidden: requires role "${role}" at ${scopeType}:${scopeId}`);
}

/** Any of the given roles satisfies the check (e.g. institution_owner OR institution_administrator). */
export async function requireAnyRole(userId: string, roles: string[], scopeType: ScopeType, scopeId: string) {
  for (const role of roles) {
    if (await hasRole(userId, role, scopeType, scopeId)) return;
  }
  throw new Error(`Forbidden: requires one of [${roles.join(", ")}] at ${scopeType}:${scopeId}`);
}

export async function listRolesForUser(userId: string) {
  return q<{ scopeType: ScopeType; scopeId: string; role: string }>(
    `SELECT scope_type AS "scopeType", scope_id AS "scopeId", role FROM role_assignments WHERE user_id=$1`,
    [userId]
  );
}

// ---------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------

export async function writeAudit(actorUserId: string, action: string, scopeType: string, scopeId: string, detail: Record<string, unknown> = {}) {
  await q(
    `INSERT INTO audit_events (id,actor_user_id,action,scope_type,scope_id,detail_json,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [newId(), actorUserId || null, action, scopeType, scopeId, JSON.stringify(detail), now()]
  );
}
export async function listAuditEvents(scopeType: string, scopeId: string) {
  return q(`SELECT id, actor_user_id AS "actorUserId", action, scope_type AS "scopeType", scope_id AS "scopeId", detail_json AS "detailJson", created_at AS "createdAt"
    FROM audit_events WHERE scope_type=$1 AND scope_id=$2 ORDER BY created_at DESC LIMIT 200`, [scopeType, scopeId]);
}

// ---------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------

const INSTITUTION_COLS = `id, name, legal_name AS "legalName", institution_type AS "institutionType", identifier, state, district,
  contact_email AS "contactEmail", age_groups_served AS "ageGroupsServed", preferred_language AS "preferredLanguage", time_zone AS "timeZone",
  status, government_org_id AS "governmentOrgId", branding_json AS "brandingJson", created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function createInstitution(ownerUserId: string, input: {
  name: string; legalName?: string; institutionType?: string; identifier?: string; state?: string; district?: string;
  contactEmail?: string; ageGroupsServed?: string; preferredLanguage?: string; timeZone?: string;
}): Promise<Institution> {
  const id = newId();
  return tx(async (client) => {
    await client.query(
      `INSERT INTO institutions (id,name,legal_name,institution_type,identifier,state,district,contact_email,age_groups_served,preferred_language,time_zone,status,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12,$12)`,
      [id, input.name, input.legalName || "", input.institutionType || "university", input.identifier || "", input.state || "", input.district || "",
        input.contactEmail || "", input.ageGroupsServed || "", input.preferredLanguage || "en", input.timeZone || "Asia/Kolkata", now()]
    );
    await client.query(
      `INSERT INTO institution_memberships (id,institution_id,user_id,status,joined_at) VALUES ($1,$2,$3,'active',$4)`,
      [newId(), id, ownerUserId, now()]
    );
    await client.query(
      `INSERT INTO role_assignments (id,user_id,scope_type,scope_id,role,granted_by,created_at) VALUES ($1,$2,'institution',$3,'institution_owner',$4,$5)`,
      [newId(), ownerUserId, id, ownerUserId, now()]
    );
    await client.query(
      `INSERT INTO audit_events (id,actor_user_id,action,scope_type,scope_id,detail_json,created_at) VALUES ($1,$2,'institution.create','institution',$3,$4,$5)`,
      [newId(), ownerUserId, id, JSON.stringify({ name: input.name }), now()]
    );
    const res = await client.query(`SELECT ${INSTITUTION_COLS} FROM institutions WHERE id=$1`, [id]);
    return res.rows[0] as Institution;
  });
}

export async function listMyInstitutions(userId: string): Promise<Institution[]> {
  return q<Institution>(
    `SELECT ${INSTITUTION_COLS} FROM institutions i
     WHERE EXISTS (SELECT 1 FROM institution_memberships m WHERE m.institution_id = i.id AND m.user_id = $1)
     ORDER BY i.created_at DESC`,
    [userId]
  );
}
export async function getInstitution(id: string): Promise<Institution | undefined> {
  const row = await qOne<Institution>(`SELECT ${INSTITUTION_COLS} FROM institutions WHERE id=$1`, [id]);
  return row ?? undefined;
}
export async function updateInstitutionStatus(id: string, status: string, actorUserId: string) {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "platform_super_administrator"], "institution", id);
  await q(`UPDATE institutions SET status=$1, updated_at=$2 WHERE id=$3`, [status, now(), id]);
  await writeAudit(actorUserId, "institution.status_change", "institution", id, { status });
}

// ---------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------

const PROGRAMME_COLS = `id, institution_id AS "institutionId", title, description, programme_type AS "programmeType", age_group AS "ageGroup",
  eligibility_note AS "eligibilityNote", geography, sector_focus AS "sectorFocus", start_date AS "startDate", end_date AS "endDate",
  application_opens_at AS "applicationOpensAt", application_closes_at AS "applicationClosesAt", cohort_size_target AS "cohortSizeTarget",
  delivery_mode AS "deliveryMode", status, visibility, data_retention_note AS "dataRetentionNote", is_demonstration AS "isDemonstration",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function createProgramme(actorUserId: string, institutionId: string, input: {
  title: string; description?: string; programmeType?: string; ageGroup?: string; deliveryMode?: string; visibility?: string;
}): Promise<Programme> {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "incubation_head", "programme_manager"], "institution", institutionId);
  const id = newId();
  await q(
    `INSERT INTO programmes (id,institution_id,title,description,programme_type,age_group,delivery_mode,status,visibility,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$9)`,
    [id, institutionId, input.title, input.description || "", input.programmeType || "university_pre_incubation",
      input.ageGroup || "18+", input.deliveryMode || "blended", input.visibility || "institution_only", now()]
  );
  await q(`INSERT INTO role_assignments (id,user_id,scope_type,scope_id,role,granted_by,created_at) VALUES ($1,$2,'programme',$3,'programme_manager',$4,$5)`,
    [newId(), actorUserId, id, actorUserId, now()]);
  await writeAudit(actorUserId, "programme.create", "programme", id, { title: input.title });
  return (await qOne<Programme>(`SELECT ${PROGRAMME_COLS} FROM programmes WHERE id=$1`, [id]))!;
}
export async function listProgrammes(institutionId: string): Promise<Programme[]> {
  return q<Programme>(`SELECT ${PROGRAMME_COLS} FROM programmes WHERE institution_id=$1 ORDER BY created_at DESC`, [institutionId]);
}
export async function getProgramme(id: string): Promise<Programme | undefined> {
  const row = await qOne<Programme>(`SELECT ${PROGRAMME_COLS} FROM programmes WHERE id=$1`, [id]);
  return row ?? undefined;
}
/** Public application discovery — programmes any signed-in founder can see
 * and apply to, regardless of institutional membership. Deliberately does
 * NOT return institution-only programmes; visibility='invite_only' is also
 * excluded here (a real invite-link flow is a documented follow-up — see
 * docs/ROADMAP.md — for now invite_only programmes are reachable only from
 * inside the owning institution's own dashboard). */
export async function listOpenPublicProgrammes(): Promise<(Programme & { institutionName: string })[]> {
  return q<Programme & { institutionName: string }>(
    `SELECT p.id, p.institution_id AS "institutionId", p.title, p.description, p.programme_type AS "programmeType", p.age_group AS "ageGroup",
      p.eligibility_note AS "eligibilityNote", p.geography, p.sector_focus AS "sectorFocus", p.start_date AS "startDate", p.end_date AS "endDate",
      p.application_opens_at AS "applicationOpensAt", p.application_closes_at AS "applicationClosesAt", p.cohort_size_target AS "cohortSizeTarget",
      p.delivery_mode AS "deliveryMode", p.status, p.visibility, p.data_retention_note AS "dataRetentionNote", p.is_demonstration AS "isDemonstration",
      p.created_at AS "createdAt", p.updated_at AS "updatedAt", i.name AS "institutionName"
     FROM programmes p JOIN institutions i ON p.institution_id = i.id
     WHERE p.status = 'applications_open' AND p.visibility = 'public'
     ORDER BY p.created_at DESC`
  );
}

export async function updateProgrammeStatus(id: string, status: string, actorUserId: string) {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", id);
  await q(`UPDATE programmes SET status=$1, updated_at=$2 WHERE id=$3`, [status, now(), id]);
  await writeAudit(actorUserId, "programme.status_change", "programme", id, { status });
}

// The default configurable 14-week journey (spec section 8). Seeded once
// per programme, then fully editable — reorder/replace/add/remove all just
// operate on these same rows.
const DEFAULT_14_WEEK_TEMPLATE: Omit<ProgrammeWeek, "id" | "programmeId" | "deadline">[] = [
  { weekNumber: 1, title: "Orientation, safety and founder expectations", learningObjective: "Understand the programme, its expectations, and how the founder's own data and content stays theirs.", activitySummary: "Orientation session; review consent and safety policy.", founderDeliverable: "Acknowledge programme expectations.", facultyGuidance: "Introduce the programme, cohort, and safeguarding contact.", mentorPrompt: "Welcome the founder; explain your availability.", evidenceRequirement: "", reflectionQuestion: "What do you want to learn from this programme?", youthSafetyNote: "Explain guardian consent and supervised-communication policy to Explorer-mode founders." },
  { weekNumber: 2, title: "Founder Fit Map", learningObjective: "Understand your own strengths, constraints and interests before choosing a problem.", activitySummary: "Complete the Founder Fit Map.", founderDeliverable: "A completed Founder Fit Map.", facultyGuidance: "Encourage honest, non-performative answers.", mentorPrompt: "Ask what surprised the founder about their own answers.", evidenceRequirement: "", reflectionQuestion: "Which of your own strengths do you trust the most?", youthSafetyNote: "" },
  { weekNumber: 3, title: "Problem discovery", learningObjective: "Identify a real, specific problem worth investigating.", activitySummary: "Research and log candidate problems.", founderDeliverable: "A short list of candidate problems with a stated source for each.", facultyGuidance: "Push for specificity over ambition.", mentorPrompt: "Which problem have you personally experienced or observed?", evidenceRequirement: "At least one sourced observation per candidate problem.", reflectionQuestion: "Why does this problem matter to the people who have it?", youthSafetyNote: "" },
  { weekNumber: 4, title: "Customer and stakeholder identification", learningObjective: "Define who actually has the problem.", activitySummary: "Draft a target-customer statement.", founderDeliverable: "A specific target-customer description.", facultyGuidance: "Challenge vague customer definitions (\"everyone\").", mentorPrompt: "How would you find three of these people this week?", evidenceRequirement: "", reflectionQuestion: "Do you personally know anyone who fits this description?", youthSafetyNote: "Explorer founders should not arrange in-person meetings with strangers without institution/guardian supervision." },
  { weekNumber: 5, title: "Existing alternatives and comparable businesses", learningObjective: "Understand how people solve this problem today.", activitySummary: "Log comparable businesses and existing alternatives.", founderDeliverable: "At least two logged comparable businesses with sources.", facultyGuidance: "Emphasize that 'no competitors' usually means the research was too shallow.", mentorPrompt: "What would make a customer switch from their current alternative?", evidenceRequirement: "Sourced comparable-business entries.", reflectionQuestion: "What do existing alternatives get right?", youthSafetyNote: "" },
  { weekNumber: 6, title: "Venture Template Library and idea generation", learningObjective: "Generate multiple venture hypotheses, not just one.", activitySummary: "Browse templates; draft 2+ Opportunity Cards.", founderDeliverable: "2 or more Opportunity Cards.", facultyGuidance: "Discourage anchoring on the first idea.", mentorPrompt: "Which idea would you be most upset to abandon — and why?", evidenceRequirement: "", reflectionQuestion: "Which idea best fits your own Founder Fit Map?", youthSafetyNote: "" },
  { weekNumber: 7, title: "Multi-idea comparison in Idea Arena", learningObjective: "Compare ideas on explicit, weighted criteria rather than gut feel.", activitySummary: "Run Idea Arena comparison.", founderDeliverable: "A recorded decision with reasoning.", facultyGuidance: "Ask founders to defend their weighting choices.", mentorPrompt: "What would change your ranking?", evidenceRequirement: "", reflectionQuestion: "What is your idea's weakest dimension?", youthSafetyNote: "" },
  { weekNumber: 8, title: "Assumption and evidence mapping", learningObjective: "Separate what is assumed from what is evidenced.", activitySummary: "Log assumptions and evidence in the Evidence Lab.", founderDeliverable: "A list of explicit assumptions and their evidence status.", facultyGuidance: "Verify at least one evidence item per founder.", mentorPrompt: "Which assumption, if wrong, kills the idea?", evidenceRequirement: "At least one classified evidence item.", reflectionQuestion: "Which assumption are you most confident in — and why?", youthSafetyNote: "" },
  { weekNumber: 9, title: "Customer interview planning", learningObjective: "Design a real, unbiased customer interview.", activitySummary: "Draft interview questions and recruitment plan.", founderDeliverable: "An interview guide.", facultyGuidance: "Check for leading questions.", mentorPrompt: "How will you avoid hearing what you want to hear?", evidenceRequirement: "", reflectionQuestion: "What answer would surprise you?", youthSafetyNote: "Explorer founders: interviews should be supervised or with people known to a trusted adult." },
  { weekNumber: 10, title: "First validation experiment", learningObjective: "Run one real experiment with a stated threshold.", activitySummary: "Design and launch an experiment in the Validation Quest Lab.", founderDeliverable: "A running experiment with a threshold and stop rule.", facultyGuidance: "Approve experiments involving money, contact info or minors' data before they run.", mentorPrompt: "What result would make you stop?", evidenceRequirement: "A defined threshold and stop rule.", reflectionQuestion: "What are you most afraid this experiment will show?", youthSafetyNote: "No money, contracts or stranger contact for Explorer-mode experiments without institution approval." },
  { weekNumber: 11, title: "Solution and minimum-test design", learningObjective: "Design the smallest possible test of the solution.", activitySummary: "Design a low-cost prototype or concierge test.", founderDeliverable: "A minimum-test plan.", facultyGuidance: "Push back on anything requiring real capital before evidence exists.", mentorPrompt: "What's the cheapest way to learn if this works?", evidenceRequirement: "", reflectionQuestion: "What are you assuming people will tolerate?", youthSafetyNote: "" },
  { weekNumber: 12, title: "Educational unit economics and Money Lab", learningObjective: "Understand your own venture's basic unit economics.", activitySummary: "Complete Money Lab base-case inputs.", founderDeliverable: "A completed base-case scenario.", facultyGuidance: "Check that inputs are sourced, not guessed round numbers.", mentorPrompt: "Which input are you least sure about?", evidenceRequirement: "", reflectionQuestion: "Does the business make sense on paper yet?", youthSafetyNote: "This is an educational calculator, not a real financial commitment." },
  { weekNumber: 13, title: "Evidence review, pivot or proceed decision", learningObjective: "Make an evidence-based decision about the venture's direction.", activitySummary: "Review readiness dashboard; decide proceed/revise/pivot/pause/stop.", founderDeliverable: "A recorded decision with reasoning.", facultyGuidance: "Normalize stopping or pivoting as a legitimate, positive outcome.", mentorPrompt: "What did the evidence actually say — not what you hoped it would say?", evidenceRequirement: "", reflectionQuestion: "What would it take to change your mind again?", youthSafetyNote: "" },
  { weekNumber: 14, title: "Venture-readiness review and demonstration session", learningObjective: "Present the venture's evidence-backed status to the cohort.", activitySummary: "Demo day / readiness review.", founderDeliverable: "A short presentation of the evidence trail (not a pitch deck — that's a deferred feature).", facultyGuidance: "Score programme completion, not venture viability.", mentorPrompt: "What's the very next step regardless of today's outcome?", evidenceRequirement: "", reflectionQuestion: "What would you tell a founder starting where you started?", youthSafetyNote: "" },
];

export async function seedDefault14WeekJourney(programmeId: string, actorUserId: string) {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", programmeId);
  const existing = await q(`SELECT id FROM programme_weeks WHERE programme_id=$1`, [programmeId]);
  if (existing.length > 0) return; // already seeded — don't duplicate
  for (const w of DEFAULT_14_WEEK_TEMPLATE) {
    await q(
      `INSERT INTO programme_weeks (id,programme_id,week_number,title,learning_objective,activity_summary,founder_deliverable,faculty_guidance,mentor_prompt,evidence_requirement,reflection_question,youth_safety_note,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
      [newId(), programmeId, w.weekNumber, w.title, w.learningObjective, w.activitySummary, w.founderDeliverable, w.facultyGuidance, w.mentorPrompt, w.evidenceRequirement, w.reflectionQuestion, w.youthSafetyNote, now()]
    );
  }
  await writeAudit(actorUserId, "programme.weeks_seeded", "programme", programmeId, { count: DEFAULT_14_WEEK_TEMPLATE.length });
}
export async function listProgrammeWeeks(programmeId: string): Promise<ProgrammeWeek[]> {
  return q<ProgrammeWeek>(
    `SELECT id, programme_id AS "programmeId", week_number AS "weekNumber", title, learning_objective AS "learningObjective",
      activity_summary AS "activitySummary", founder_deliverable AS "founderDeliverable", faculty_guidance AS "facultyGuidance",
      mentor_prompt AS "mentorPrompt", evidence_requirement AS "evidenceRequirement", reflection_question AS "reflectionQuestion",
      youth_safety_note AS "youthSafetyNote", deadline
      FROM programme_weeks WHERE programme_id=$1 ORDER BY week_number ASC`,
    [programmeId]
  );
}

// ---------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------

const COHORT_COLS = `id, programme_id AS "programmeId", name, status, start_date AS "startDate", end_date AS "endDate", is_demonstration AS "isDemonstration", created_at AS "createdAt"`;

export async function createCohort(actorUserId: string, programmeId: string, name: string): Promise<Cohort> {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", programmeId);
  const id = newId();
  await q(`INSERT INTO cohorts (id,programme_id,name,status,created_at,updated_at) VALUES ($1,$2,$3,'forming',$4,$4)`, [id, programmeId, name, now()]);
  await writeAudit(actorUserId, "cohort.create", "cohort", id, { name, programmeId });
  return (await qOne<Cohort>(`SELECT ${COHORT_COLS} FROM cohorts WHERE id=$1`, [id]))!;
}
export async function listCohorts(programmeId: string): Promise<Cohort[]> {
  return q<Cohort>(`SELECT ${COHORT_COLS} FROM cohorts WHERE programme_id=$1 ORDER BY created_at DESC`, [programmeId]);
}
export async function getCohort(id: string): Promise<Cohort | undefined> {
  const row = await qOne<Cohort>(`SELECT ${COHORT_COLS} FROM cohorts WHERE id=$1`, [id]);
  return row ?? undefined;
}
export async function enrolFounderInCohort(actorUserId: string, cohortId: string, founderUserId: string) {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "cohort", cohortId);
  await q(
    `INSERT INTO cohort_memberships (id,cohort_id,user_id,role_in_cohort,status,joined_at) VALUES ($1,$2,$3,'founder','active',$4)
     ON CONFLICT (cohort_id, user_id) DO NOTHING`,
    [newId(), cohortId, founderUserId, now()]
  );
  // Scoping of this founder's future opportunities to this cohort's programme/
  // institution happens lazily at Opportunity-create time (D-014, see
  // getFounderProgrammeContext below) by reading this membership row, not
  // here — nothing to precompute or touch on the founder's other rows.
  await writeAudit(actorUserId, "cohort.enrol", "cohort", cohortId, { founderUserId });
}
export async function listCohortMembers(cohortId: string): Promise<CohortMembership[]> {
  return q<CohortMembership>(
    `SELECT id, cohort_id AS "cohortId", user_id AS "userId", role_in_cohort AS "roleInCohort", status, joined_at AS "joinedAt" FROM cohort_memberships WHERE cohort_id=$1`,
    [cohortId]
  );
}

/** Same as listCohortMembers, joined with the real name/email on file for
 * that founder — for the cohort-roster UI (D-016). */
export async function listCohortMembersWithNames(cohortId: string): Promise<(CohortMembership & { userName: string; userEmail: string })[]> {
  return q<CohortMembership & { userName: string; userEmail: string }>(
    `SELECT cm.id, cm.cohort_id AS "cohortId", cm.user_id AS "userId", cm.role_in_cohort AS "roleInCohort", cm.status, cm.joined_at AS "joinedAt",
      u.name AS "userName", u.email AS "userEmail"
     FROM cohort_memberships cm JOIN users u ON cm.user_id = u.id
     WHERE cm.cohort_id=$1 ORDER BY cm.joined_at ASC`,
    [cohortId]
  );
}

const MEMBERSHIP_STATUSES = ["active", "graduated", "withdrawn", "deferred"] as const;
export type CohortMembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/**
 * D-016 (docs/DECISION_LOG.md): a real status-change action — the
 * `cohort_memberships.status` column has supported graduated/withdrawn/
 * deferred since D-004, but nothing ever wrote anything other than
 * 'active'. RBAC-checked the same way every other cohort write is (a role
 * at cohort, programme, or institution scope).
 */
export async function updateCohortMembershipStatus(actorUserId: string, membershipId: string, status: CohortMembershipStatus) {
  if (!MEMBERSHIP_STATUSES.includes(status)) throw new Error(`Invalid status "${status}"`);
  const membership = await qOne<{ id: string; cohortId: string; userId: string }>(
    `SELECT id, cohort_id AS "cohortId", user_id AS "userId" FROM cohort_memberships WHERE id=$1`,
    [membershipId]
  );
  if (!membership) throw new Error("Cohort membership not found");
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "cohort", membership.cohortId);
  await q(`UPDATE cohort_memberships SET status=$1 WHERE id=$2`, [status, membershipId]);
  await writeAudit(actorUserId, "cohort_membership.status_change", "cohort", membership.cohortId, { membershipId, status, founderUserId: membership.userId });
}

/**
 * D-016: transfers a founder's active membership from one cohort to
 * another cohort in the SAME programme (a real, scoped decision — see
 * DECISION_LOG for why cross-programme transfer isn't included). The old
 * membership is marked 'withdrawn', never deleted, so its history stays on
 * the audit trail; the target membership is reactivated if one already
 * exists (a founder returning to a cohort they'd previously left) or
 * created fresh otherwise.
 */
export async function transferCohortMembership(actorUserId: string, membershipId: string, targetCohortId: string) {
  const membership = await qOne<{ id: string; cohortId: string; userId: string; status: string }>(
    `SELECT id, cohort_id AS "cohortId", user_id AS "userId", status FROM cohort_memberships WHERE id=$1`,
    [membershipId]
  );
  if (!membership) throw new Error("Cohort membership not found");
  if (membership.status !== "active") throw new Error("Only an active membership can be transferred — change its status back to active first.");
  if (membership.cohortId === targetCohortId) throw new Error("Founder is already in this cohort");
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "cohort", membership.cohortId);
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "cohort", targetCohortId);
  const sourceCohort = await getCohort(membership.cohortId);
  const targetCohort = await getCohort(targetCohortId);
  if (!sourceCohort || !targetCohort) throw new Error("Cohort not found");
  if (sourceCohort.programmeId !== targetCohort.programmeId) {
    throw new Error("Transfer is only supported between cohorts within the same programme right now.");
  }
  await q(`UPDATE cohort_memberships SET status='withdrawn' WHERE id=$1`, [membershipId]);
  const existingTarget = await qOne<{ id: string }>(`SELECT id FROM cohort_memberships WHERE cohort_id=$1 AND user_id=$2`, [targetCohortId, membership.userId]);
  if (existingTarget) {
    await q(`UPDATE cohort_memberships SET status='active', joined_at=$1 WHERE id=$2`, [now(), existingTarget.id]);
  } else {
    await q(
      `INSERT INTO cohort_memberships (id,cohort_id,user_id,role_in_cohort,status,joined_at) VALUES ($1,$2,$3,'founder','active',$4)`,
      [newId(), targetCohortId, membership.userId, now()]
    );
  }
  await writeAudit(actorUserId, "cohort_membership.transfer", "cohort", targetCohortId, { membershipId, fromCohortId: membership.cohortId, founderUserId: membership.userId });
}

/**
 * D-014 (docs/DECISION_LOG.md): the reverse lookup — given a founder's
 * userId, find their own most recent ACTIVE cohort membership (if any).
 * Deliberately picks the most recently joined active membership when a
 * founder somehow has more than one; returns undefined (never a fabricated
 * default) when the founder has no active cohort membership at all.
 */
export async function getActiveCohortMembershipForUser(userId: string): Promise<CohortMembership | undefined> {
  const row = await qOne<CohortMembership>(
    `SELECT id, cohort_id AS "cohortId", user_id AS "userId", role_in_cohort AS "roleInCohort", status, joined_at AS "joinedAt"
     FROM cohort_memberships WHERE user_id=$1 AND status='active' ORDER BY joined_at DESC LIMIT 1`,
    [userId]
  );
  return row ?? undefined;
}

export type FounderProgrammeContext = {
  membership: CohortMembership;
  cohort: Cohort;
  programme: Programme;
  institution: Institution;
};

/**
 * D-014: resolves the full real chain (cohort → programme → institution) for
 * a founder's own active cohort membership, or returns undefined if the
 * founder isn't enrolled anywhere — used to auto-scope new Opportunities and
 * to show the founder honest "you're enrolled in X's Y cohort" context. Never
 * guesses or defaults to a "demo" institution.
 */
export async function getFounderProgrammeContext(userId: string): Promise<FounderProgrammeContext | undefined> {
  const membership = await getActiveCohortMembershipForUser(userId);
  if (!membership) return undefined;
  const cohort = await getCohort(membership.cohortId);
  if (!cohort) return undefined;
  const programme = await getProgramme(cohort.programmeId);
  if (!programme) return undefined;
  const institution = await getInstitution(programme.institutionId);
  if (!institution) return undefined;
  return { membership, cohort, programme, institution };
}

/** Cohort health indicators (spec section 11) — computed live from real rows, no opaque single score. */
export async function computeCohortHealth(cohortId: string) {
  const members = await listCohortMembers(cohortId);
  const founderIds = members.filter((m) => m.roleInCohort === "founder").map((m) => m.userId);
  let experimentsDesigned = 0, experimentsCompleted = 0, evidenceSubmitted = 0, evidenceVerified = 0;
  for (const uid of founderIds) {
    const exps = await q<{ threshold: string; result: string }>(`SELECT threshold, result FROM experiments WHERE user_id=$1`, [uid]);
    experimentsDesigned += exps.filter((e) => e.threshold).length;
    experimentsCompleted += exps.filter((e) => (e.result || "").trim().length > 0).length;
    const ev = await q<{ evClass: string }>(`SELECT ev_class AS "evClass" FROM evidence_items WHERE user_id=$1`, [uid]);
    evidenceSubmitted += ev.length;
    evidenceVerified += ev.filter((e) => e.evClass !== "assumption").length;
  }
  return {
    enrolment: founderIds.length,
    activeFounders: founderIds.length, // "active" = enrolled with active status; a real last-activity threshold is a documented follow-up (see ROADMAP)
    experimentsDesigned,
    experimentsCompleted,
    evidenceSubmitted,
    evidenceVerified,
  };
}

// ---------------------------------------------------------------------
// Applications (minimal vertical-slice version — one form per programme,
// text/textarea/declaration questions, single evaluator flow)
// ---------------------------------------------------------------------

export async function createApplicationForm(actorUserId: string, programmeId: string, questions: { label: string; fieldType?: string; required?: boolean }[]) {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", programmeId);
  const id = newId();
  await q(`INSERT INTO application_forms (id,programme_id,created_at,updated_at) VALUES ($1,$2,$3,$3) ON CONFLICT (programme_id) DO NOTHING`, [id, programmeId, now()]);
  const form = await qOne<{ id: string }>(`SELECT id FROM application_forms WHERE programme_id=$1`, [programmeId]);
  const formId = form!.id;
  let order = 0;
  for (const question of questions) {
    await q(
      `INSERT INTO application_questions (id,form_id,"order",label,field_type,required) VALUES ($1,$2,$3,$4,$5,$6)`,
      [newId(), formId, order++, question.label, question.fieldType || "textarea", question.required ?? true]
    );
  }
  await writeAudit(actorUserId, "application_form.create", "programme", programmeId, { formId });
  return formId;
}
export async function getApplicationForm(programmeId: string) {
  const form = await qOne<{ id: string; programmeId: string }>(`SELECT id, programme_id AS "programmeId" FROM application_forms WHERE programme_id=$1`, [programmeId]);
  if (!form) return null;
  const questions = await q<{ id: string; order: number; label: string; fieldType: string; required: boolean }>(
    `SELECT id, "order", label, field_type AS "fieldType", required FROM application_questions WHERE form_id=$1 ORDER BY "order" ASC`,
    [form.id]
  );
  return { ...form, questions };
}

export async function submitApplication(applicantUserId: string, formId: string, answers: Record<string, string>) {
  const id = newId();
  await q(
    `INSERT INTO applications (id,form_id,applicant_user_id,answers_json,status,submitted_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,'submitted',$5,$5,$5)`,
    [id, formId, applicantUserId, JSON.stringify(answers), now()]
  );
  await writeAudit(applicantUserId, "application.submit", "application", id, {});
  return id;
}
export async function listApplicationsForProgramme(programmeId: string): Promise<Application[]> {
  return q<Application>(
    `SELECT a.id, a.form_id AS "formId", a.applicant_user_id AS "applicantUserId", a.answers_json AS "answersJson", a.status, a.submitted_at AS "submittedAt", a.created_at AS "createdAt"
     FROM applications a JOIN application_forms f ON a.form_id = f.id WHERE f.programme_id=$1 ORDER BY a.created_at DESC`,
    [programmeId]
  );
}
export async function getApplication(id: string): Promise<Application | undefined> {
  const row = await qOne<Application>(
    `SELECT id, form_id AS "formId", applicant_user_id AS "applicantUserId", answers_json AS "answersJson", status, submitted_at AS "submittedAt", created_at AS "createdAt" FROM applications WHERE id=$1`,
    [id]
  );
  return row ?? undefined;
}
export async function assignEvaluator(actorUserId: string, applicationId: string, evaluatorUserId: string) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error("Application not found");
  const form = await qOne<{ programmeId: string }>(`SELECT programme_id AS "programmeId" FROM application_forms WHERE id=$1`, [app.formId]);
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", form!.programmeId);
  await q(
    `INSERT INTO evaluator_assignments (id,application_id,evaluator_user_id,status,created_at) VALUES ($1,$2,$3,'assigned',$4)
     ON CONFLICT (application_id, evaluator_user_id) DO NOTHING`,
    [newId(), applicationId, evaluatorUserId, now()]
  );
  await q(`UPDATE applications SET status='under_evaluation', updated_at=$1 WHERE id=$2 AND status IN ('submitted','eligibility_review','eligible')`, [now(), applicationId]);
  await writeAudit(actorUserId, "application.assign_evaluator", "application", applicationId, { evaluatorUserId });
}
// ---------------------------------------------------------------------
// Evaluation rubric & scoring (D-015, docs/DECISION_LOG.md) — the
// `evaluation_rubrics`/`evaluation_criteria`/`evaluation_scores` tables
// already existed (D-006), but nothing built or read a real rubric; every
// evaluator was submitting free-text reasoning only. A rubric is created
// lazily on the first criterion a programme manager adds — never seeded
// with example criteria, since a real evaluation rubric is a real
// judgement call for the institution to make, not something to invent for
// them.
// ---------------------------------------------------------------------

export async function getRubricForProgramme(programmeId: string): Promise<(EvaluationRubric & { criteria: EvaluationCriterion[] }) | undefined> {
  const rubric = await qOne<EvaluationRubric>(
    `SELECT id, programme_id AS "programmeId", is_blind_review AS "isBlindReview", created_at AS "createdAt" FROM evaluation_rubrics WHERE programme_id=$1`,
    [programmeId]
  );
  if (!rubric) return undefined;
  const criteria = await q<EvaluationCriterion>(
    `SELECT id, rubric_id AS "rubricId", label, weight, kind, "order" FROM evaluation_criteria WHERE rubric_id=$1 ORDER BY "order" ASC`,
    [rubric.id]
  );
  return { ...rubric, criteria };
}

export async function addEvaluationCriterion(
  actorUserId: string,
  programmeId: string,
  input: { label: string; weight?: number; kind?: string }
): Promise<EvaluationCriterion> {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", programmeId);
  if (!input.label.trim()) throw new Error("Criterion label is required");
  let rubric = await qOne<{ id: string }>(`SELECT id FROM evaluation_rubrics WHERE programme_id=$1`, [programmeId]);
  if (!rubric) {
    const rubricId = newId();
    await q(`INSERT INTO evaluation_rubrics (id,programme_id,is_blind_review,created_at) VALUES ($1,$2,false,$3)`, [rubricId, programmeId, now()]);
    rubric = { id: rubricId };
  }
  const countRow = await qOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM evaluation_criteria WHERE rubric_id=$1`, [rubric.id]);
  const order = Number(countRow?.count || 0);
  const weight = Math.max(1, Math.round(input.weight ?? 1));
  const kind = ["objective_eligibility_rule", "human_judgement", "derived_metric", "ai_assisted_observation"].includes(input.kind || "")
    ? input.kind!
    : "human_judgement";
  const id = newId();
  await q(
    `INSERT INTO evaluation_criteria (id,rubric_id,label,weight,kind,"order") VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, rubric.id, input.label.trim(), weight, kind, order]
  );
  await writeAudit(actorUserId, "rubric.add_criterion", "programme", programmeId, { label: input.label, weight, kind });
  return (await qOne<EvaluationCriterion>(`SELECT id, rubric_id AS "rubricId", label, weight, kind, "order" FROM evaluation_criteria WHERE id=$1`, [id]))!;
}

export async function removeEvaluationCriterion(actorUserId: string, programmeId: string, criterionId: string) {
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", programmeId);
  await q(
    `DELETE FROM evaluation_criteria ec USING evaluation_rubrics er WHERE ec.rubric_id = er.id AND er.programme_id = $1 AND ec.id = $2`,
    [programmeId, criterionId]
  );
  await writeAudit(actorUserId, "rubric.remove_criterion", "programme", programmeId, { criterionId });
}

export async function listMyEvaluatorAssignments(evaluatorUserId: string) {
  return q(
    `SELECT ea.id, ea.application_id AS "applicationId", ea.status, a.status AS "applicationStatus", a.form_id AS "formId"
     FROM evaluator_assignments ea JOIN applications a ON ea.application_id = a.id WHERE ea.evaluator_user_id=$1`,
    [evaluatorUserId]
  );
}
/** A human evaluator's own reasoning + criterion scores. AI may only assist by summarizing — never write this row itself (spec section 10).
 * D-015 (docs/DECISION_LOG.md): scores are now actually persisted, keyed to
 * a real criterionId from this programme's rubric — previously this
 * parameter was accepted but silently dropped (every caller passed `[]`). */
export async function submitEvaluation(evaluatorUserId: string, applicationId: string, reasoning: string, scores: { criterionId: string; score: number }[]) {
  const assigned = await qOne(`SELECT id FROM evaluator_assignments WHERE application_id=$1 AND evaluator_user_id=$2`, [applicationId, evaluatorUserId]);
  if (!assigned) throw new Error("Not assigned to evaluate this application");
  const id = newId();
  await q(
    `INSERT INTO evaluations (id,application_id,evaluator_user_id,reasoning,status,submitted_at,created_at) VALUES ($1,$2,$3,$4,'submitted',$5,$5)
     ON CONFLICT (application_id, evaluator_user_id) DO UPDATE SET reasoning=$4, status='submitted', submitted_at=$5`,
    [id, applicationId, evaluatorUserId, reasoning, now()]
  );
  const evaluation = await qOne<{ id: string }>(`SELECT id FROM evaluations WHERE application_id=$1 AND evaluator_user_id=$2`, [applicationId, evaluatorUserId]);
  const evaluationId = evaluation!.id;
  for (const s of scores) {
    if (!s.criterionId || !Number.isFinite(s.score)) continue;
    await q(
      `INSERT INTO evaluation_scores (id,evaluation_id,criterion_id,score) VALUES ($1,$2,$3,$4)
       ON CONFLICT (evaluation_id, criterion_id) DO UPDATE SET score=$4`,
      [newId(), evaluationId, s.criterionId, s.score]
    );
  }
  await q(`UPDATE evaluator_assignments SET status='completed' WHERE application_id=$1 AND evaluator_user_id=$2`, [applicationId, evaluatorUserId]);
  await writeAudit(evaluatorUserId, "evaluation.submit", "application", applicationId, { scoreCount: scores.length });
}

/** Every evaluation submitted for an application, with its persisted
 * per-criterion scores joined against the real criterion labels/weights,
 * plus a weighted average. Never a single opaque "overall score" fabricated
 * by the platform — a programme manager sees exactly what each evaluator
 * actually scored. */
export async function listEvaluationsForApplication(applicationId: string): Promise<EvaluationWithScores[]> {
  const evaluations = await q<{ id: string; applicationId: string; evaluatorUserId: string; reasoning: string; status: string; submittedAt: string | null }>(
    `SELECT id, application_id AS "applicationId", evaluator_user_id AS "evaluatorUserId", reasoning, status, submitted_at AS "submittedAt"
     FROM evaluations WHERE application_id=$1 ORDER BY created_at ASC`,
    [applicationId]
  );
  const result: EvaluationWithScores[] = [];
  for (const ev of evaluations) {
    const scores = await q<{ criterionId: string; label: string; weight: number; score: number }>(
      `SELECT es.criterion_id AS "criterionId", ec.label, ec.weight, es.score
       FROM evaluation_scores es JOIN evaluation_criteria ec ON es.criterion_id = ec.id
       WHERE es.evaluation_id=$1 ORDER BY ec."order" ASC`,
      [ev.id]
    );
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const weightedTotal = totalWeight > 0 ? scores.reduce((sum, s) => sum + s.weight * s.score, 0) / totalWeight : null;
    result.push({ ...ev, scores, weightedTotal });
  }
  return result;
}

/** Immutable decision record — a human (programme manager/admin) must call this; never invoked by AI. */
export async function recordSelectionDecision(actorUserId: string, applicationId: string, outcome: "selected" | "not_selected" | "waitlisted", reasoning: string) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error("Application not found");
  const form = await qOne<{ programmeId: string }>(`SELECT programme_id AS "programmeId" FROM application_forms WHERE id=$1`, [app.formId]);
  await requireAnyRole(actorUserId, ["institution_owner", "institution_administrator", "programme_manager"], "programme", form!.programmeId);
  const existing = await qOne(`SELECT id FROM selection_decisions WHERE application_id=$1`, [applicationId]);
  if (existing) throw new Error("Selection decision already recorded for this application — decisions are immutable once made.");
  await q(
    `INSERT INTO selection_decisions (id,application_id,outcome,reasoning,decided_by,decided_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [newId(), applicationId, outcome, reasoning, actorUserId, now()]
  );
  const statusMap = { selected: "selected", not_selected: "not_selected", waitlisted: "waitlisted" } as const;
  await q(`UPDATE applications SET status=$1, updated_at=$2 WHERE id=$3`, [statusMap[outcome], now(), applicationId]);
  await writeAudit(actorUserId, "application.select", "application", applicationId, { outcome });
}

/** Selecting an applicant enrols them straight into the cohort — the one connected end-to-end path this release guarantees (spec D-006 item 5). */
export async function selectAndEnrol(actorUserId: string, applicationId: string, reasoning: string, cohortId: string) {
  await recordSelectionDecision(actorUserId, applicationId, "selected", reasoning);
  const app = await getApplication(applicationId);
  await enrolFounderInCohort(actorUserId, cohortId, app!.applicantUserId);
}
