"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { revalidatePath } from "next/cache";
import * as repo from "./repo";
import { AI_ENABLED, callClaudeForUser } from "./aiClient";
import { submitInsightCandidate, approveInsightCandidate, rejectInsightCandidate } from "./insights";

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

export async function saveFounderProfile(formData: FormData) {
  const userId = await requireUserId();
  await repo.upsertFounderProfile(userId, {
    strengths: String(formData.get("strengths") || ""),
    develop: String(formData.get("develop") || ""),
    time: String(formData.get("time") || ""),
    capital: String(formData.get("capital") || ""),
    risk: String(formData.get("risk") || "Medium"),
    categories: String(formData.get("categories") || ""),
  });
  revalidatePath("/dashboard/fitmap");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/map");
}

export async function addOpportunity(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");
  const wasEmpty = (await repo.listOpportunities(userId)).length === 0;
  const created = await repo.createOpportunity(userId, {
    title,
    customer: String(formData.get("customer") || ""),
    problem: String(formData.get("problem") || ""),
    evidenceClass: String(formData.get("evidenceClass") || "assumption"),
    evidenceNote: String(formData.get("evidenceNote") || ""),
    difficulty: String(formData.get("difficulty") || "Medium"),
    capital: String(formData.get("capital") || "Medium"),
    mission: String(formData.get("mission") || ""),
    dimFit: 5, dimEvidence: 5, dimCustomer: 5, dimDefensibility: 5,
    dimCapital: 5, dimMargin: 5, dimScale: 5, dimSocial: 5,
  });
  // Auto-connect the journey: the first card a founder adds is unambiguously
  // "the" idea they're working on — no need to make them separately mark it
  // active. With 2+ cards, they choose explicitly (see setActiveOpportunity).
  if (wasEmpty) await repo.setActiveOpportunityId(userId, created.id);
  revalidatePath("/dashboard/opportunities");
  revalidatePath("/dashboard/arena");
  revalidatePath("/dashboard/map");
  revalidatePath("/dashboard");
}

export async function removeOpportunity(id: string) {
  const userId = await requireUserId();
  await repo.deleteOpportunity(id, userId);
  if (await repo.getActiveOpportunityId(userId) === id) await repo.setActiveOpportunityId(userId, "");
  revalidatePath("/dashboard/opportunities");
  revalidatePath("/dashboard/arena");
}

/** D-021 (docs/DECISION_LOG.md): a founder explicitly opts a specific card
 * in to the insight library — never automatic, never bundled into saving
 * the card itself. Creates a PENDING candidate only; nothing is used by
 * the AI until a platform admin reviews and rewrites it. Errors (already
 * shared, Explorer without a confirmed guardian) surface to the founder
 * via the form's own error boundary — same pattern as every other action
 * here that can throw. */
export async function shareOpportunityAsInsight(id: string) {
  const userId = await requireUserId();
  const card = await repo.getOpportunity(id, userId);
  if (!card) throw new Error("Opportunity not found");
  const text = [
    `Title: ${card.title}`,
    card.customer ? `Customer: ${card.customer}` : "",
    card.problem ? `Problem: ${card.problem}` : "",
    card.mission ? `First validation mission: ${card.mission}` : "",
  ].filter(Boolean).join("\n");
  await submitInsightCandidate(userId, "idea_generation", text, { type: "opportunity", id: card.id });
  revalidatePath("/dashboard/opportunities");
}

/** D-021: an admin's review action. `approveInsightCandidate` itself
 * enforces the platform_super_administrator role — this is just the form
 * plumbing, same division of responsibility as every other action here. */
export async function approveInsightCandidateAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const anonymizedText = String(formData.get("anonymizedText") || "");
  await approveInsightCandidate(userId, id, anonymizedText);
  revalidatePath("/dashboard/admin/insights");
}

export async function rejectInsightCandidateAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const note = String(formData.get("note") || "");
  await rejectInsightCandidate(userId, id, note);
  revalidatePath("/dashboard/admin/insights");
}

/** Lets the founder explicitly choose which idea the rest of their journey
 * (Evidence, Rival Radar, Validation, Money, Passport) stays connected to —
 * needed once there are 2+ cards and the choice can't be made for them. */
export async function setActiveOpportunity(id: string) {
  const userId = await requireUserId();
  if (id) {
    const found = await repo.getOpportunity(id, userId);
    if (!found) throw new Error("Opportunity not found");
  }
  await repo.setActiveOpportunityId(userId, id);
  revalidatePath("/dashboard/opportunities");
  revalidatePath("/dashboard/arena");
  revalidatePath("/dashboard/evidence");
  revalidatePath("/dashboard/rivals");
  revalidatePath("/dashboard/validation");
  revalidatePath("/dashboard/money");
  revalidatePath("/dashboard/passport");
  revalidatePath("/dashboard");
}

export async function setOpportunityDim(id: string, dim: string, value: number) {
  const userId = await requireUserId();
  const allowed = ["dimFit","dimEvidence","dimCustomer","dimDefensibility","dimCapital","dimMargin","dimScale","dimSocial"];
  if (!allowed.includes(dim)) return;
  await repo.updateOpportunityDims(id, userId, { [dim]: Math.max(0, Math.min(10, value)) } as Record<string, number>);
  revalidatePath("/dashboard/arena");
}

export async function addExperiment(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");
  await repo.createExperiment(userId, {
    name,
    hypothesis: String(formData.get("hypothesis") || ""),
    method: String(formData.get("method") || ""),
    kpi: String(formData.get("kpi") || ""),
    threshold: String(formData.get("threshold") || ""),
    stopRule: String(formData.get("stopRule") || ""),
    opportunityId: String(formData.get("opportunityId") || ""),
    involvesMoney: formData.get("involvesMoney") === "on",
    involvesContract: formData.get("involvesContract") === "on",
    involvesStrangerContact: formData.get("involvesStrangerContact") === "on",
    result: "",
  });
  revalidatePath("/dashboard/validation");
  revalidatePath("/dashboard/passport");
}

export async function updateExperimentResult(id: string, result: string) {
  const userId = await requireUserId();
  await repo.updateExperimentResult(id, userId, result);
  revalidatePath("/dashboard/validation");
  revalidatePath("/dashboard/passport");
  revalidatePath("/dashboard");
}

export async function updateExperimentVerdict(id: string, metThreshold: "yes" | "no" | "unknown") {
  const userId = await requireUserId();
  await repo.updateExperimentVerdict(id, userId, metThreshold);
  revalidatePath("/dashboard/validation");
  revalidatePath("/dashboard/passport");
  revalidatePath("/dashboard");
}

export async function removeExperiment(id: string) {
  const userId = await requireUserId();
  await repo.deleteExperiment(id, userId);
  revalidatePath("/dashboard/validation");
}

export async function addEvidence(formData: FormData) {
  const userId = await requireUserId();
  const claim = String(formData.get("claim") || "").trim();
  if (!claim) throw new Error("Claim is required");
  await repo.createEvidence(userId, {
    claim,
    metric: String(formData.get("metric") || ""),
    evClass: String(formData.get("evClass") || "assumption"),
    publisher: String(formData.get("publisher") || ""),
    url: String(formData.get("url") || ""),
    geography: String(formData.get("geography") || ""),
    dataPeriod: String(formData.get("dataPeriod") || ""),
    license: String(formData.get("license") || ""),
    accessDate: String(formData.get("accessDate") || ""),
    opportunityId: String(formData.get("opportunityId") || ""),
    supersedesId: String(formData.get("supersedesId") || ""),
  });
  revalidatePath("/dashboard/evidence");
  revalidatePath("/dashboard/passport");
  revalidatePath("/dashboard/plan");
}

export async function removeEvidence(id: string) {
  const userId = await requireUserId();
  await repo.deleteEvidence(id, userId);
  revalidatePath("/dashboard/evidence");
  revalidatePath("/dashboard/passport");
}

export async function addRisk(formData: FormData) {
  const userId = await requireUserId();
  const risk = String(formData.get("risk") || "").trim();
  if (!risk) throw new Error("Risk name is required");
  await repo.createRisk(userId, {
    risk,
    mitigation: String(formData.get("mitigation") || ""),
    severity: String(formData.get("severity") || "Medium"),
  });
  revalidatePath("/dashboard/passport");
}

export async function removeRisk(id: string) {
  const userId = await requireUserId();
  await repo.deleteRisk(id, userId);
  revalidatePath("/dashboard/passport");
}

export async function updateScenarioField(scenario: string, field: string, value: number) {
  const userId = await requireUserId();
  const allowed = ["price","cac","churn","cogsPct","fixedMonthly","startUnits","growth","annualPriceGrowthPct","annualCacInflationPct","annualFixedCostInflationPct","taxRatePct","startingCash"];
  if (!allowed.includes(field)) return;
  await repo.updateScenario(userId, scenario, { [field]: value } as Record<string, number>);
  revalidatePath("/dashboard/money");
}

const LENS_TEMPLATES: Record<string, (next: string) => string> = {
  Coach: (next) => `Good to have you here. Right now the clearest next step in this workspace is to ${next}. Small, real steps beat a polished plan you haven't tested.`,
  Teacher: (next) => `Let's ground this in a concept: evidence quality isn't about volume, it's about whether it could change your decision. Once you ${next}, we can talk through what would move a claim from grey (assumption) to blue or green.`,
  Operator: (next) => `Shortest path forward: ${next}. Don't wait for the rest of the workspace to be filled in — momentum on one real action beats completeness.`,
  Challenger: (next) => `Before we go further — what would have to be true for your current biggest assumption to be wrong? If you can't answer that, ${next} first.`,
};

const LENS_SYSTEM_PROMPTS: Record<string, string> = {
  Coach: "You are Kaya, a warm, encouraging startup coach for a first-time Gen Z founder in India using the Z Cubs founder-education platform. Be concise (3-5 sentences), specific to their real workspace state below, and always ground advice in evidence over polish.",
  Teacher: "You are Kaya, a startup-methodology teacher for a first-time Gen Z founder in India. Explain one concrete concept (evidence quality, validation, unit economics, etc.) grounded in their real workspace state below. Concise (3-5 sentences).",
  Operator: "You are Kaya, a blunt, execution-focused startup operator advising a first-time Gen Z founder in India. Give the single shortest real next step given their workspace state below. Concise (2-4 sentences), no fluff.",
  Challenger: "You are Kaya, a skeptical startup challenger who stress-tests assumptions for a first-time Gen Z founder in India. Ask one sharp, specific question about their riskiest current assumption, grounded in their real workspace state below. Concise (2-4 sentences).",
};

export async function sendMentorMessage(lens: string, content: string) {
  const userId = await requireUserId();
  await repo.addMentorMessage(userId, lens, "user", content);
  const profile = await repo.getFounderProfile(userId);
  const opportunities = await repo.listOpportunities(userId);
  const experiments = await repo.listExperiments(userId);
  const evidence = await repo.listEvidence(userId);
  const { total: readiness } = await repo.computeReadiness(userId);
  const next = !profile ? "complete Self Discovery"
    : opportunities.length === 0 ? "add an Opportunity Card"
    : experiments.length === 0 ? "define one experiment in the Validation Quest Lab"
    : evidence.length === 0 ? "add a sourced evidence item"
    : "run the experiment you've defined and record a real result";

  let reply: string | null = null;
  if (AI_ENABLED) {
    const system = LENS_SYSTEM_PROMPTS[lens] ?? LENS_SYSTEM_PROMPTS.Coach;
    const stateSummary = [
      `Self Discovery: ${profile ? "complete" : "not started"}`,
      `Opportunity Cards: ${opportunities.length}`,
      `Experiments: ${experiments.length} (${experiments.filter((e) => e.metThreshold === "yes").length} met their threshold)`,
      `Evidence items logged: ${evidence.length}`,
      `Venture readiness score: ${readiness}%`,
      `Suggested next step: ${next}`,
    ].join("\n");
    const aiReply = await callClaudeForUser(userId, "mentor_chat", system, `Real current workspace state:\n${stateSummary}\n\nFounder's message: ${content}`, { maxTokens: 300 });
    if (aiReply) reply = aiReply.trim();
  }
  if (!reply) {
    const template = LENS_TEMPLATES[lens] ?? LENS_TEMPLATES.Coach;
    reply = template(next) + " (Generated from your real session state.)";
  }
  await repo.addMentorMessage(userId, lens, "mentor", reply);
  revalidatePath("/dashboard");
  return reply;
}

// ---------- comparable-company outcomes ----------
export async function addComparableCompany(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Company name is required");
  await repo.createComparableCompany(userId, {
    name,
    opportunityId: String(formData.get("opportunityId") || ""),
    sourceUrl: String(formData.get("sourceUrl") || ""),
    sourcePublisher: String(formData.get("sourcePublisher") || ""),
    status: (String(formData.get("status") || "unknown") as repo.ComparableCompany["status"]),
    statusNote: String(formData.get("statusNote") || ""),
    lastRechecked: String(formData.get("statusNote") || "") ? new Date().toISOString() : "",
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/dashboard/comparables");
}
export async function recheckComparable(id: string, status: repo.ComparableCompany["status"], statusNote: string) {
  const userId = await requireUserId();
  await repo.recheckComparableCompany(id, userId, { status, statusNote });
  revalidatePath("/dashboard/comparables");
}
export async function removeComparable(id: string) {
  const userId = await requireUserId();
  await repo.deleteComparableCompany(id, userId);
  revalidatePath("/dashboard/comparables");
}

// ---------- investor / ecosystem tracker ----------
export async function addEcosystemContact(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");
  await repo.createEcosystemContact(userId, {
    name,
    opportunityId: String(formData.get("opportunityId") || ""),
    kind: (String(formData.get("kind") || "investor") as repo.EcosystemContact["kind"]),
    focus: String(formData.get("focus") || ""),
    stage: String(formData.get("stage") || ""),
    sourceUrl: String(formData.get("sourceUrl") || ""),
    applicationStatus: (String(formData.get("applicationStatus") || "not_started") as repo.EcosystemContact["applicationStatus"]),
    deadline: String(formData.get("deadline") || ""),
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/dashboard/ecosystem");
}
export async function updateEcosystemStatus(id: string, status: repo.EcosystemContact["applicationStatus"]) {
  const userId = await requireUserId();
  await repo.updateEcosystemContactStatus(id, userId, status);
  revalidatePath("/dashboard/ecosystem");
}
export async function removeEcosystemContact(id: string) {
  const userId = await requireUserId();
  await repo.deleteEcosystemContact(id, userId);
  revalidatePath("/dashboard/ecosystem");
}

// ---------- business plan ----------
export async function saveBusinessPlanSection(formData: FormData) {
  const userId = await requireUserId();
  await repo.saveBusinessPlan(userId, {
    executiveSummary: String(formData.get("executiveSummary") || ""),
    marketSection: String(formData.get("marketSection") || ""),
    businessModelSection: String(formData.get("businessModelSection") || ""),
    goToMarketSection: String(formData.get("goToMarketSection") || ""),
    opsSection: String(formData.get("opsSection") || ""),
  });
  await repo.logActivity(userId, "plan_saved");
  revalidatePath("/dashboard/plan");
}
export async function loadPlanDraft() {
  const userId = await requireUserId();
  return await repo.assemblePlanDraft(userId);
}

// ---------- operate / monitor (actuals) ----------
export async function logActuals(formData: FormData) {
  const userId = await requireUserId();
  const period = String(formData.get("period") || "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Period must be YYYY-MM");
  await repo.upsertActuals(userId, {
    period,
    opportunityId: String(formData.get("opportunityId") || ""),
    revenue: Number(formData.get("revenue") || 0),
    customers: Number(formData.get("customers") || 0),
    costs: Number(formData.get("costs") || 0),
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/dashboard/plan");
}
export async function removeActuals(id: string) {
  const userId = await requireUserId();
  await repo.deleteActuals(id, userId);
  revalidatePath("/dashboard/plan");
}

// ---------- India Ledger (DPR-lite) ----------
export async function saveDprField(field: string, value: number) {
  const userId = await requireUserId();
  const allowed = ["landBuilding","machinery","workingCapitalMargin","preliminaryExpenses","contingency","promoterContribution","termLoanAmount","termLoanRatePct","termLoanTenureYears","wcLoanAmount","wcLoanRatePct"];
  if (!allowed.includes(field)) return;
  await repo.saveDprInputs(userId, { [field]: value } as Record<string, number>);
  await repo.logActivity(userId, "dpr_updated", field);
  revalidatePath("/dashboard/dpr");
}

// ---------- institutional layer (tenancy / programmes / cohorts /
// applications / evaluation) — see src/lib/institutional.ts and
// docs/DECISION_LOG.md D-004/D-005/D-006. ----------
import * as inst from "./institutional";
import * as mentorship from "./mentorship";
import * as consent from "./consent";
import * as facilitators from "./facilitators";

// ---------- Privacy: consent, guardian relationships, data rights (D-010) ----------
export async function addGuardianAction(formData: FormData) {
  const userId = await requireUserId();
  const { relationship, confirmToken } = await consent.addGuardianRelationship(userId, {
    guardianName: String(formData.get("guardianName") || ""),
    guardianEmail: String(formData.get("guardianEmail") || ""),
    guardianPhone: String(formData.get("guardianPhone") || ""),
    relationship: String(formData.get("relationshipType") || "parent/guardian"),
  });
  // No email-sending service is wired up yet (that's a real, separate
  // buildable item — a provider-neutral email abstraction, already listed
  // as Planned in docs/ROADMAP.md). Until then the confirm link is shown
  // directly to the account holder to pass along, rather than silently
  // doing nothing or faking a "sent" state.
  revalidatePath("/dashboard/privacy");
  return { relationship, confirmToken };
}

export async function confirmGuardianAction(relationshipId: string, confirmToken: string) {
  await consent.confirmGuardianRelationship(relationshipId, confirmToken);
  revalidatePath("/dashboard/privacy");
}

export async function revokeGuardianAction(relationshipId: string) {
  await consent.revokeGuardianRelationship(relationshipId);
  revalidatePath("/dashboard/privacy");
}

export async function recordConsentAction(consentType: string, granted: boolean) {
  const userId = await requireUserId();
  await consent.recordConsent(userId, consentType, granted, "self");
  revalidatePath("/dashboard/privacy");
}

export async function requestDataDeletionAction(formData: FormData) {
  const userId = await requireUserId();
  await consent.requestDataAction(userId, "deletion", String(formData.get("note") || ""));
  revalidatePath("/dashboard/privacy");
}

export async function createInstitutionAction(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Institution name is required");
  await inst.createInstitution(userId, {
    name,
    institutionType: String(formData.get("institutionType") || "university"),
    state: String(formData.get("state") || ""),
    contactEmail: String(formData.get("contactEmail") || ""),
  });
  revalidatePath("/dashboard/institution");
}

export async function createProgrammeAction(institutionId: string, formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Programme title is required");
  const programme = await inst.createProgramme(userId, institutionId, {
    title,
    description: String(formData.get("description") || ""),
    programmeType: String(formData.get("programmeType") || "university_pre_incubation"),
    ageGroup: String(formData.get("ageGroup") || "18+"),
    visibility: String(formData.get("visibility") || "institution_only"),
  });
  await inst.seedDefault14WeekJourney(programme.id, userId);
  await inst.createApplicationForm(userId, programme.id, [
    { label: "Venture idea or problem you want to work on", fieldType: "textarea", required: true },
    { label: "Why does this problem matter to you?", fieldType: "textarea", required: true },
    { label: "I understand my venture work stays mine — the programme does not take ownership of it", fieldType: "declaration", required: true },
  ]);
  revalidatePath("/dashboard/institution");
}

export async function updateProgrammeStatusAction(programmeId: string, status: string) {
  const userId = await requireUserId();
  await inst.updateProgrammeStatus(programmeId, status, userId);
  revalidatePath("/dashboard/institution");
}

export async function createCohortAction(programmeId: string, formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Cohort name is required");
  await inst.createCohort(userId, programmeId, name);
  revalidatePath("/dashboard/institution");
}

export async function submitApplicationAction(formId: string, formData: FormData) {
  const userId = await requireUserId();
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("q_")) answers[key.slice(2)] = String(value);
  }
  await inst.submitApplication(userId, formId, answers);
  revalidatePath("/dashboard/institution");
}

export async function assignEvaluatorAction(applicationId: string, evaluatorEmail: string) {
  const userId = await requireUserId();
  const evaluator = await repo.getUserByEmail(evaluatorEmail.toLowerCase().trim());
  if (!evaluator) throw new Error("No user found with that email — they need an existing Z Cubs account.");
  await inst.assignEvaluator(userId, applicationId, evaluator.id);
  revalidatePath("/dashboard/institution");
}

export async function submitEvaluationAction(applicationId: string, formData: FormData) {
  const userId = await requireUserId();
  const reasoning = String(formData.get("reasoning") || "");
  // D-015: per-criterion scores come in as score_<criterionId> fields,
  // rendered dynamically from this programme's real rubric — see
  // src/app/dashboard/institution/page.tsx. A blank field is left out
  // entirely rather than coerced to 0, so "didn't score this one" is never
  // indistinguishable from "scored it zero".
  const scores: { criterionId: string; score: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("score_") && String(value).trim() !== "") {
      const score = Number(value);
      if (Number.isFinite(score)) scores.push({ criterionId: key.slice("score_".length), score });
    }
  }
  await inst.submitEvaluation(userId, applicationId, reasoning, scores);
  revalidatePath("/dashboard/institution");
}

export async function addEvaluationCriterionAction(programmeId: string, formData: FormData) {
  const userId = await requireUserId();
  const label = String(formData.get("label") || "").trim();
  if (!label) throw new Error("Criterion label is required");
  const weight = Number(formData.get("weight") || 1);
  const kind = String(formData.get("kind") || "human_judgement");
  await inst.addEvaluationCriterion(userId, programmeId, { label, weight, kind });
  revalidatePath("/dashboard/institution");
}

export async function removeEvaluationCriterionAction(programmeId: string, criterionId: string) {
  const userId = await requireUserId();
  await inst.removeEvaluationCriterion(userId, programmeId, criterionId);
  revalidatePath("/dashboard/institution");
}

export async function updateCohortMembershipStatusAction(membershipId: string, formData: FormData) {
  const userId = await requireUserId();
  const status = String(formData.get("status") || "");
  await inst.updateCohortMembershipStatus(userId, membershipId, status as inst.CohortMembershipStatus);
  revalidatePath("/dashboard/institution");
}

export async function transferCohortMembershipAction(membershipId: string, formData: FormData) {
  const userId = await requireUserId();
  const targetCohortId = String(formData.get("targetCohortId") || "");
  if (!targetCohortId) throw new Error("Choose a cohort to transfer to");
  await inst.transferCohortMembership(userId, membershipId, targetCohortId);
  revalidatePath("/dashboard/institution");
}

export async function selectAndEnrolAction(applicationId: string, cohortId: string, reasoning: string) {
  const userId = await requireUserId();
  await inst.selectAndEnrol(userId, applicationId, reasoning, cohortId);
  revalidatePath("/dashboard/institution");
}

export async function recordSelectionDecisionAction(applicationId: string, outcome: "not_selected" | "waitlisted", reasoning: string) {
  const userId = await requireUserId();
  await inst.recordSelectionDecision(userId, applicationId, outcome, reasoning);
  revalidatePath("/dashboard/institution");
}

// ---------- Guide (guided business-planning journey) ----------
export async function saveGuideField(stepId: string, fieldKey: string, value: string) {
  const userId = await requireUserId();
  await repo.saveGuideStepFields(userId, stepId, { [fieldKey]: value });
}
export async function saveGuideItemsAction(stepId: string, listKey: string, itemsJson: string) {
  const userId = await requireUserId();
  let items: unknown[] = [];
  try { items = JSON.parse(itemsJson); } catch { items = []; }
  if (!Array.isArray(items)) items = [];
  await repo.saveGuideStepItems(userId, stepId, listKey, items);
}
export async function saveGuideNotesAction(stepId: string, notes: string) {
  const userId = await requireUserId();
  await repo.saveGuideStepNotes(userId, stepId, notes);
}

// ---------- Mentor Discovery & Matching (D-008) ----------
export async function upsertMentorProfileAction(formData: FormData) {
  const userId = await requireUserId();
  await mentorship.upsertMentorProfile(userId, {
    headline: String(formData.get("headline") || ""),
    bio: String(formData.get("bio") || ""),
    expertiseTags: String(formData.get("expertiseTags") || ""),
    sectors: String(formData.get("sectors") || ""),
    mentorshipMode: String(formData.get("mentorshipMode") || "virtual"),
    languages: String(formData.get("languages") || "English"),
    capacityPerMonth: Number(formData.get("capacityPerMonth") || 4),
    credentialsNote: String(formData.get("credentialsNote") || ""),
    attestationConfirmed: formData.get("attestationConfirmed") === "on",
    referenceName: String(formData.get("referenceName") || ""),
    referenceEmail: String(formData.get("referenceEmail") || ""),
    referenceRelationship: String(formData.get("referenceRelationship") || ""),
  });
  revalidatePath("/dashboard/mentors");
}

export async function setMentorStatusAction(status: "active" | "paused") {
  const userId = await requireUserId();
  await mentorship.setMentorStatus(userId, status);
  revalidatePath("/dashboard/mentors");
}

export async function requestMentorshipAction(mentorUserId: string, formData: FormData) {
  const userId = await requireUserId();
  await mentorship.requestMentorship(userId, mentorUserId, String(formData.get("focusArea") || ""), String(formData.get("message") || ""));
  revalidatePath("/dashboard/mentors");
}

export async function respondToRequestAction(requestId: string, accept: boolean, declineNote = "") {
  const userId = await requireUserId();
  await mentorship.respondToRequest(userId, requestId, accept, declineNote);
  revalidatePath("/dashboard/mentors");
}

export async function markRequestCompletedAction(requestId: string) {
  const userId = await requireUserId();
  await mentorship.markRequestCompleted(userId, requestId);
  revalidatePath("/dashboard/mentors");
}

export async function logMentorshipSessionAction(requestId: string, formData: FormData) {
  const userId = await requireUserId();
  await mentorship.logSession(
    userId, requestId,
    String(formData.get("sessionDate") || new Date().toISOString().slice(0, 10)),
    String(formData.get("summary") || ""),
    String(formData.get("nextSteps") || "")
  );
  revalidatePath("/dashboard/mentors");
}

export async function setNextCheckinAction(requestId: string, formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("nextCheckinAt") || "");
  await mentorship.setNextCheckin(userId, requestId, date || null);
  revalidatePath("/dashboard/mentors");
}

// ---------------------------------------------------------------------
// D-022: Faculty-enablement / train-the-trainer track
// ---------------------------------------------------------------------

export async function grantFacilitatorRoleAction(institutionId: string, formData: FormData) {
  const userId = await requireUserId();
  const targetUserId = String(formData.get("userId") || "");
  if (!targetUserId) throw new Error("Choose a member to designate as a facilitator.");
  await facilitators.grantFacilitatorRole(userId, institutionId, targetUserId);
  revalidatePath("/dashboard/institution");
}

export async function acknowledgeWeekReadinessAction(programmeId: string, weekNumber: number) {
  const userId = await requireUserId();
  await facilitators.acknowledgeWeekReadiness(userId, programmeId, weekNumber);
  revalidatePath("/dashboard/institution");
}

export async function logFacilitatedSessionAction(cohortId: string, weekNumber: number, formData: FormData) {
  const userId = await requireUserId();
  const summary = String(formData.get("summary") || "");
  const foundersPresent = Number(formData.get("foundersPresent") || 0);
  await facilitators.logFacilitatedSession(userId, cohortId, weekNumber, summary, foundersPresent);
  revalidatePath("/dashboard/institution");
}
