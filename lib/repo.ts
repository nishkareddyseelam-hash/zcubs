import { q, qOne, tx, newId, now } from "./pg";
import { computeMonthlyProjection } from "./financialModel";
import { hasConfirmedGuardianConsent } from "./consent";
import { getFounderProgrammeContext } from "./institutional";

// NOTE ON THIS FILE'S MIGRATION (see docs/DECISION_LOG.md D-002/D-007):
// every exported function here used to be a synchronous node:sqlite call.
// They are now async Postgres queries with the exact same names and
// return shapes (camelCase fields, ISO date strings) so every existing
// caller only needed `await` added, not a rewrite. SQL below aliases every
// snake_case column to its camelCase JS name so the row shape matches the
// pre-existing TypeScript types unchanged.

export type User = {
  id: string; name: string; email: string; passwordHash: string;
  ageBand: string; createdAt: string;
};
export type FounderProfile = {
  id: string; userId: string; strengths: string; develop: string; time: string;
  capital: string; risk: string; categories: string; updatedAt: string;
};
export type Opportunity = {
  id: string; userId: string; title: string; customer: string; problem: string;
  evidenceClass: string; evidenceNote: string; difficulty: string; capital: string;
  mission: string; dimFit: number; dimEvidence: number; dimCustomer: number;
  dimDefensibility: number; dimCapital: number; dimMargin: number; dimScale: number;
  dimSocial: number; createdAt: string;
  ventureTeamId: string | null; institutionId: string | null; programmeId: string | null; cohortId: string | null;
};
export type Experiment = {
  id: string; userId: string; name: string; hypothesis: string; method: string;
  kpi: string; threshold: string; result: string;
  metThreshold: "yes" | "no" | "unknown";
  stopRule: string;
  opportunityId: string;
  /** D-012 (docs/DECISION_LOG.md): self-declared, structured risk flags —
   * never inferred from free text — used to gate Explorer (13-17) accounts
   * behind confirmed guardian consent (D-010) for experiments that involve
   * real-world money, a contract, or contacting someone not already known
   * to the founder. Defaults false for every existing/adult experiment. */
  involvesMoney: boolean;
  involvesContract: boolean;
  involvesStrangerContact: boolean;
  createdAt: string;
};
export type EvidenceItem = {
  id: string; userId: string; claim: string; metric: string; evClass: string;
  publisher: string; url: string; createdAt: string;
  geography: string; dataPeriod: string; license: string; accessDate: string;
  opportunityId: string;
  supersedesId: string;
};
export type ComparableCompany = {
  id: string; userId: string; opportunityId: string; name: string;
  sourceUrl: string; sourcePublisher: string;
  status: "operating" | "shut_down" | "acquired" | "merged" | "unknown";
  statusNote: string; lastRechecked: string; notes: string; createdAt: string;
};
export type EcosystemContact = {
  id: string; userId: string; opportunityId: string;
  kind: "investor" | "incubator" | "accelerator" | "grant" | "supplier" | "lender";
  name: string; focus: string; stage: string; sourceUrl: string;
  applicationStatus: "not_started" | "researching" | "applied" | "in_review" | "awarded" | "rejected" | "declined";
  deadline: string; notes: string; createdAt: string; updatedAt: string;
};
export type BusinessPlan = {
  userId: string; executiveSummary: string; marketSection: string;
  businessModelSection: string; goToMarketSection: string; opsSection: string; updatedAt: string;
};
export type ActualsEntry = {
  id: string; userId: string; opportunityId: string; period: string;
  revenue: number; customers: number; costs: number; notes: string; createdAt: string;
};
export type DprInputs = {
  userId: string; landBuilding: number; machinery: number; workingCapitalMargin: number;
  preliminaryExpenses: number; contingency: number; promoterContribution: number;
  termLoanAmount: number; termLoanRatePct: number; termLoanTenureYears: number;
  wcLoanAmount: number; wcLoanRatePct: number; updatedAt: string;
};
export type Risk = {
  id: string; userId: string; risk: string; mitigation: string; severity: string; createdAt: string;
};
export type FinancialScenario = {
  id: string; userId: string; scenario: string; price: number; cac: number; churn: number;
  cogsPct: number; fixedMonthly: number; startUnits: number; growth: number;
  annualPriceGrowthPct: number; annualCacInflationPct: number; annualFixedCostInflationPct: number;
  taxRatePct: number; startingCash: number; updatedAt: string;
};
export type ActivityKind =
  | "profile_saved" | "opportunity_added" | "experiment_added" | "experiment_verified"
  | "evidence_added" | "risk_added" | "scenario_updated"
  | "comparable_added" | "ecosystem_contact_added" | "actuals_logged" | "dpr_updated" | "plan_saved";
export type ActivityEvent = { id: string; userId: string; kind: ActivityKind; detail: string; createdAt: string };

// ---------- users ----------
export async function createUser(input: { name: string; email: string; passwordHash: string; ageBand: string }): Promise<User> {
  const id = newId();
  await q(
    `INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, input.name, input.email, input.passwordHash, input.ageBand, now()]
  );
  return (await getUserById(id))!;
}
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const row = await qOne<User>(
    `SELECT id, name, email, password_hash AS "passwordHash", age_band AS "ageBand", created_at AS "createdAt" FROM users WHERE email = $1`,
    [email]
  );
  return row ?? undefined;
}
export async function getUserById(id: string): Promise<User | undefined> {
  const row = await qOne<User>(
    `SELECT id, name, email, password_hash AS "passwordHash", age_band AS "ageBand", created_at AS "createdAt" FROM users WHERE id = $1`,
    [id]
  );
  return row ?? undefined;
}

// ---------- activity log ----------
export async function logActivity(userId: string, kind: ActivityKind, detail = "") {
  await q(`INSERT INTO activity_log (id,user_id,kind,detail,created_at) VALUES ($1,$2,$3,$4,$5)`, [newId(), userId, kind, detail, now()]);
}
export async function listActivity(userId: string): Promise<ActivityEvent[]> {
  return q<ActivityEvent>(
    `SELECT id, user_id AS "userId", kind, detail, created_at AS "createdAt" FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
}

// ---------- founder profile ----------
export async function upsertFounderProfile(userId: string, input: Omit<FounderProfile, "id" | "userId" | "updatedAt">): Promise<FounderProfile> {
  const existing = await getFounderProfile(userId);
  if (existing) {
    await q(
      `UPDATE founder_profiles SET strengths=$1, develop=$2, time=$3, capital=$4, risk=$5, categories=$6, updated_at=$7 WHERE user_id=$8`,
      [input.strengths, input.develop, input.time, input.capital, input.risk, input.categories, now(), userId]
    );
  } else {
    await q(
      `INSERT INTO founder_profiles (id,user_id,strengths,develop,time,capital,risk,categories,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [newId(), userId, input.strengths, input.develop, input.time, input.capital, input.risk, input.categories, now()]
    );
  }
  await logActivity(userId, "profile_saved");
  return (await getFounderProfile(userId))!;
}
export async function getFounderProfile(userId: string): Promise<FounderProfile | undefined> {
  const row = await qOne<FounderProfile>(
    `SELECT id, user_id AS "userId", strengths, develop, time, capital, risk, categories, updated_at AS "updatedAt" FROM founder_profiles WHERE user_id = $1`,
    [userId]
  );
  return row ?? undefined;
}

// ---------- opportunities ----------
const OPPORTUNITY_COLS = `id, user_id AS "userId", title, customer, problem, evidence_class AS "evidenceClass", evidence_note AS "evidenceNote",
  difficulty, capital, mission, dim_fit AS "dimFit", dim_evidence AS "dimEvidence", dim_customer AS "dimCustomer",
  dim_defensibility AS "dimDefensibility", dim_capital AS "dimCapital", dim_margin AS "dimMargin", dim_scale AS "dimScale",
  dim_social AS "dimSocial", created_at AS "createdAt", venture_team_id AS "ventureTeamId", institution_id AS "institutionId",
  programme_id AS "programmeId", cohort_id AS "cohortId"`;

export async function listOpportunities(userId: string): Promise<Opportunity[]> {
  return q<Opportunity>(`SELECT ${OPPORTUNITY_COLS} FROM opportunities WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}
export async function createOpportunity(userId: string, input: Omit<Opportunity, "id" | "userId" | "createdAt" | "ventureTeamId" | "institutionId" | "programmeId" | "cohortId">): Promise<Opportunity> {
  const id = newId();
  // D-014 (docs/DECISION_LOG.md): if this founder has a real, live, active
  // cohort membership, stamp the new Opportunity with that cohort's real
  // programme/institution IDs. Never fabricated or defaulted — a founder
  // with no cohort membership simply gets NULLs, same as before D-014.
  const context = await getFounderProgrammeContext(userId);
  await q(
    `INSERT INTO opportunities (id,user_id,title,customer,problem,evidence_class,evidence_note,difficulty,capital,mission,
      dim_fit,dim_evidence,dim_customer,dim_defensibility,dim_capital,dim_margin,dim_scale,dim_social,created_at,
      institution_id,programme_id,cohort_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [id, userId, input.title, input.customer, input.problem, input.evidenceClass, input.evidenceNote, input.difficulty, input.capital, input.mission,
      input.dimFit, input.dimEvidence, input.dimCustomer, input.dimDefensibility, input.dimCapital, input.dimMargin, input.dimScale, input.dimSocial, now(),
      context?.institution.id ?? null, context?.programme.id ?? null, context?.cohort.id ?? null]
  );
  await logActivity(userId, "opportunity_added", input.title);
  return (await qOne<Opportunity>(`SELECT ${OPPORTUNITY_COLS} FROM opportunities WHERE id = $1`, [id]))!;
}
export async function updateOpportunityDims(id: string, userId: string, dims: Partial<Pick<Opportunity, "dimFit"|"dimEvidence"|"dimCustomer"|"dimDefensibility"|"dimCapital"|"dimMargin"|"dimScale"|"dimSocial">>) {
  const colMap: Record<string, string> = { dimFit: "dim_fit", dimEvidence: "dim_evidence", dimCustomer: "dim_customer", dimDefensibility: "dim_defensibility", dimCapital: "dim_capital", dimMargin: "dim_margin", dimScale: "dim_scale", dimSocial: "dim_social" };
  const cols = Object.keys(dims);
  if (!cols.length) return;
  const setClause = cols.map((c, i) => `${colMap[c]} = $${i + 1}`).join(", ");
  const values = cols.map((c) => (dims as Record<string, number>)[c]);
  await q(`UPDATE opportunities SET ${setClause} WHERE id = $${cols.length + 1} AND user_id = $${cols.length + 2}`, [...values, id, userId]);
}
export async function deleteOpportunity(id: string, userId: string) {
  await q(`DELETE FROM opportunities WHERE id = $1 AND user_id = $2`, [id, userId]);
}
export async function getOpportunity(id: string, userId: string): Promise<Opportunity | undefined> {
  const row = await qOne<Opportunity>(`SELECT ${OPPORTUNITY_COLS} FROM opportunities WHERE id = $1 AND user_id = $2`, [id, userId]);
  return row ?? undefined;
}

// ---------- active idea ----------
export async function getActiveOpportunityId(userId: string): Promise<string> {
  const row = await qOne<{ activeOpportunityId: string }>(`SELECT active_opportunity_id AS "activeOpportunityId" FROM app_state WHERE user_id = $1`, [userId]);
  return row?.activeOpportunityId || "";
}
export async function setActiveOpportunityId(userId: string, opportunityId: string) {
  const existing = await qOne(`SELECT user_id FROM app_state WHERE user_id = $1`, [userId]);
  if (existing) {
    await q(`UPDATE app_state SET active_opportunity_id = $1 WHERE user_id = $2`, [opportunityId, userId]);
  } else {
    await q(`INSERT INTO app_state (user_id, active_opportunity_id) VALUES ($1,$2)`, [userId, opportunityId]);
  }
}
export async function getActiveOpportunity(userId: string): Promise<Opportunity | undefined> {
  const activeId = await getActiveOpportunityId(userId);
  if (activeId) {
    const found = await getOpportunity(activeId, userId);
    if (found) return found;
  }
  const all = await listOpportunities(userId);
  return all.length === 1 ? all[0] : undefined;
}

// ---------- experiments ----------
const EXPERIMENT_COLS = `id, user_id AS "userId", name, hypothesis, method, kpi, threshold, result,
  met_threshold AS "metThreshold", stop_rule AS "stopRule", opportunity_id AS "opportunityId",
  involves_money AS "involvesMoney", involves_contract AS "involvesContract",
  involves_stranger_contact AS "involvesStrangerContact", created_at AS "createdAt"`;

export async function listExperiments(userId: string): Promise<Experiment[]> {
  return q<Experiment>(`SELECT ${EXPERIMENT_COLS} FROM experiments WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}
export async function createExperiment(userId: string, input: Omit<Experiment, "id" | "userId" | "createdAt" | "metThreshold">): Promise<Experiment> {
  // D-012: real-world-risk gate, scoped narrowly — this blocks nothing
  // about signing up or using the platform, only the specific act of
  // declaring an experiment that involves real money, a contract, or
  // contacting someone the founder doesn't already know, for an Explorer
  // (13-17) account that has no confirmed guardian relationship yet.
  const risky = input.involvesMoney || input.involvesContract || input.involvesStrangerContact;
  if (risky) {
    const user = await getUserById(userId);
    if (user?.ageBand === "explorer" && !(await hasConfirmedGuardianConsent(userId))) {
      throw new Error(
        "This experiment involves real money, a contract, or contacting someone you don't already know. Explorer accounts need a confirmed guardian (Privacy & Consent page) before running an experiment like this."
      );
    }
  }
  const id = newId();
  await q(
    `INSERT INTO experiments (id,user_id,name,hypothesis,method,kpi,threshold,result,met_threshold,stop_rule,opportunity_id,involves_money,involves_contract,involves_stranger_contact,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [id, userId, input.name, input.hypothesis, input.method, input.kpi, input.threshold, input.result, "unknown", input.stopRule || "", input.opportunityId || "",
      input.involvesMoney, input.involvesContract, input.involvesStrangerContact, now()]
  );
  await logActivity(userId, "experiment_added", input.name);
  return (await qOne<Experiment>(`SELECT ${EXPERIMENT_COLS} FROM experiments WHERE id = $1`, [id]))!;
}
export async function updateExperimentResult(id: string, userId: string, result: string) {
  await q(`UPDATE experiments SET result = $1, met_threshold = 'unknown' WHERE id = $2 AND user_id = $3`, [result, id, userId]);
}
export async function updateExperimentVerdict(id: string, userId: string, metThreshold: "yes" | "no" | "unknown") {
  await q(`UPDATE experiments SET met_threshold = $1 WHERE id = $2 AND user_id = $3`, [metThreshold, id, userId]);
  if (metThreshold === "yes") {
    const exp = await qOne<{ name: string }>(`SELECT name FROM experiments WHERE id = $1`, [id]);
    await logActivity(userId, "experiment_verified", exp?.name || "");
  }
}
export async function deleteExperiment(id: string, userId: string) {
  await q(`DELETE FROM experiments WHERE id = $1 AND user_id = $2`, [id, userId]);
}

// ---------- evidence ----------
const EVIDENCE_COLS = `id, user_id AS "userId", claim, metric, ev_class AS "evClass", publisher, url, created_at AS "createdAt",
  geography, data_period AS "dataPeriod", license, access_date AS "accessDate", opportunity_id AS "opportunityId", supersedes_id AS "supersedesId"`;

export async function listEvidence(userId: string): Promise<EvidenceItem[]> {
  return q<EvidenceItem>(`SELECT ${EVIDENCE_COLS} FROM evidence_items WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}
export async function createEvidence(userId: string, input: Omit<EvidenceItem, "id" | "userId" | "createdAt">): Promise<EvidenceItem> {
  const id = newId();
  await q(
    `INSERT INTO evidence_items (id,user_id,claim,metric,ev_class,publisher,url,created_at,geography,data_period,license,access_date,opportunity_id,supersedes_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, userId, input.claim, input.metric, input.evClass, input.publisher, input.url, now(),
      input.geography || "", input.dataPeriod || "", input.license || "", input.accessDate || "", input.opportunityId || "", input.supersedesId || ""]
  );
  await logActivity(userId, "evidence_added", input.claim);
  return (await qOne<EvidenceItem>(`SELECT ${EVIDENCE_COLS} FROM evidence_items WHERE id = $1`, [id]))!;
}
export async function deleteEvidence(id: string, userId: string) {
  await q(`DELETE FROM evidence_items WHERE id = $1 AND user_id = $2`, [id, userId]);
}
export async function findEvidenceConflicts(userId: string) {
  const items = await listEvidence(userId);
  const supersededIds = new Set(items.map(i => i.supersedesId).filter(Boolean));
  const live = items.filter(i => !supersededIds.has(i.id));
  const byClaim = new Map<string, EvidenceItem[]>();
  for (const it of live) {
    const key = it.claim.trim().toLowerCase();
    if (!key) continue;
    if (!byClaim.has(key)) byClaim.set(key, []);
    byClaim.get(key)!.push(it);
  }
  const conflicts: { claim: string; items: EvidenceItem[] }[] = [];
  for (const [claim, group] of byClaim) {
    if (group.length < 2) continue;
    const distinctMetrics = new Set(group.map(g => g.metric.trim().toLowerCase()).filter(Boolean));
    const distinctClasses = new Set(group.map(g => g.evClass));
    if (distinctMetrics.size > 1 || distinctClasses.size > 1) {
      conflicts.push({ claim, items: group });
    }
  }
  return conflicts;
}

// ---------- risks ----------
export async function listRisks(userId: string): Promise<Risk[]> {
  return q<Risk>(`SELECT id, user_id AS "userId", risk, mitigation, severity, created_at AS "createdAt" FROM risks WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}
export async function createRisk(userId: string, input: Omit<Risk, "id" | "userId" | "createdAt">): Promise<Risk> {
  const id = newId();
  await q(`INSERT INTO risks (id,user_id,risk,mitigation,severity,created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [id, userId, input.risk, input.mitigation, input.severity, now()]);
  await logActivity(userId, "risk_added", input.risk);
  return (await qOne<Risk>(`SELECT id, user_id AS "userId", risk, mitigation, severity, created_at AS "createdAt" FROM risks WHERE id = $1`, [id]))!;
}
export async function deleteRisk(id: string, userId: string) {
  await q(`DELETE FROM risks WHERE id = $1 AND user_id = $2`, [id, userId]);
}

// ---------- financial scenarios ----------
const SCENARIO_DEFAULTS: Record<string, number> = { conservative: 0.08, base: 0.06, upside: 0.045, stress: 0.14 };
const SCENARIO_COLS = `id, user_id AS "userId", scenario, price, cac, churn, cogs_pct AS "cogsPct", fixed_monthly AS "fixedMonthly",
  start_units AS "startUnits", growth, annual_price_growth_pct AS "annualPriceGrowthPct", annual_cac_inflation_pct AS "annualCacInflationPct",
  annual_fixed_cost_inflation_pct AS "annualFixedCostInflationPct", tax_rate_pct AS "taxRatePct", starting_cash AS "startingCash", updated_at AS "updatedAt"`;

export async function getScenario(userId: string, scenario: string): Promise<FinancialScenario> {
  const existing = await qOne<FinancialScenario>(`SELECT ${SCENARIO_COLS} FROM financial_scenarios WHERE user_id = $1 AND scenario = $2`, [userId, scenario]);
  if (existing) return existing;
  const id = newId();
  const churn = SCENARIO_DEFAULTS[scenario] ?? 0.06;
  await q(
    `INSERT INTO financial_scenarios (id,user_id,scenario,price,cac,churn,cogs_pct,fixed_monthly,start_units,growth,annual_price_growth_pct,annual_cac_inflation_pct,annual_fixed_cost_inflation_pct,tax_rate_pct,starting_cash,updated_at) VALUES ($1,$2,$3,0,0,$4,0.35,0,0,0,0,0,0,0,0,$5)`,
    [id, userId, scenario, churn, now()]
  );
  return (await qOne<FinancialScenario>(`SELECT ${SCENARIO_COLS} FROM financial_scenarios WHERE id = $1`, [id]))!;
}
export async function updateScenario(userId: string, scenario: string, input: Partial<Pick<FinancialScenario, "price"|"cac"|"churn"|"cogsPct"|"fixedMonthly"|"startUnits"|"growth"|"annualPriceGrowthPct"|"annualCacInflationPct"|"annualFixedCostInflationPct"|"taxRatePct"|"startingCash">>) {
  await getScenario(userId, scenario); // ensure row exists
  const colMap: Record<string, string> = {
    price: "price", cac: "cac", churn: "churn", cogsPct: "cogs_pct", fixedMonthly: "fixed_monthly", startUnits: "start_units",
    growth: "growth", annualPriceGrowthPct: "annual_price_growth_pct", annualCacInflationPct: "annual_cac_inflation_pct",
    annualFixedCostInflationPct: "annual_fixed_cost_inflation_pct", taxRatePct: "tax_rate_pct", startingCash: "starting_cash",
  };
  const cols = Object.keys(input);
  if (!cols.length) return;
  const setClause = cols.map((c, i) => `${colMap[c]} = $${i + 1}`).join(", ");
  const values = cols.map((c) => (input as Record<string, number>)[c]);
  await q(`UPDATE financial_scenarios SET ${setClause}, updated_at = $${cols.length + 1} WHERE user_id = $${cols.length + 2} AND scenario = $${cols.length + 3}`, [...values, now(), userId, scenario]);
  await logActivity(userId, "scenario_updated", scenario);
}

// ---------- mentor ----------
export async function listMentorMessages(userId: string, lens: string) {
  return q<{ id: string; userId: string; lens: string; role: string; content: string; createdAt: string }>(
    `SELECT id, user_id AS "userId", lens, role, content, created_at AS "createdAt" FROM mentor_messages WHERE user_id = $1 AND lens = $2 ORDER BY created_at ASC`,
    [userId, lens]
  );
}
export async function addMentorMessage(userId: string, lens: string, role: "user" | "mentor", content: string) {
  await q(`INSERT INTO mentor_messages (id,user_id,lens,role,content,created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [newId(), userId, lens, role, content, now()]);
}

// ---------- readiness (computed from real rows, not fabricated) ----------
export async function computeReadiness(userId: string) {
  const profile = await getFounderProfile(userId);
  const opportunities = await listOpportunities(userId);
  const experiments = await listExperiments(userId);
  const evidence = await listEvidence(userId);
  const risks = await listRisks(userId);
  const base = await getScenario(userId, "base");

  const profileFields = profile ? [profile.strengths, profile.develop, profile.time, profile.capital, profile.risk, profile.categories] : [];
  const filledFields = profileFields.filter(f => (f || "").trim().length > 3).length;
  const fitScore = profile ? Math.round((filledFields / profileFields.length) * 100) : 0;

  const evidencedOpportunities = opportunities.filter(o => (o.evidenceNote || "").trim().length > 0 && o.evidenceClass !== "assumption");
  const problemScore = Math.min(100, evidencedOpportunities.length * 35);

  const runExperiments = experiments.filter(e => (e.threshold || "").trim().length > 0 && (e.result || "").trim().length > 0);
  const validationScore = Math.min(100, runExperiments.length * 30);

  const metExperiments = experiments.filter(e => e.metThreshold === "yes");
  const customerScore = Math.min(100, metExperiments.length * 50);

  const qualifyingEvidence = evidence.filter(e => e.evClass !== "assumption" && ((e.publisher || "").trim().length > 0 || (e.url || "").trim().length > 0));
  const marketScore = Math.min(100, qualifyingEvidence.length * 25);

  let unitScore = 0, unitWhy = "Enter your base-case price, CAC and cost inputs in Money Lab to score this.";
  if (base.price > 0 && base.startUnits > 0) {
    const contributionPerUnit = base.price * (1 - base.cogsPct);
    if (contributionPerUnit <= 0) {
      unitScore = 0; unitWhy = "Base-case cost of goods sold meets or exceeds price — contribution margin is not positive.";
    } else {
      const impliedLtv = base.churn > 0 ? contributionPerUnit / base.churn : contributionPerUnit * 12;
      const ltvToCac = base.cac > 0 ? impliedLtv / base.cac : impliedLtv > 0 ? Infinity : 0;
      unitScore = ltvToCac >= 3 ? 100 : ltvToCac >= 1 ? 60 : 20;
      unitWhy = base.cac > 0
        ? `Base-case implied LTV:CAC is ${ltvToCac === Infinity ? "undefined (CAC is 0)" : ltvToCac.toFixed(1) + ":1"}.`
        : "Contribution margin is positive, but no CAC is entered yet.";
    }
  }

  const risksWithMitigation = risks.filter(r => (r.mitigation || "").trim().length > 3);
  const riskScore = Math.min(100, risksWithMitigation.length * 34);
  const capitalScore = 0;

  const dims = [
    { k: "fit", label: "Founder fit", w: 15, v: fitScore, why: profile ? `${filledFields}/${profileFields.length} Self Discovery fields meaningfully filled in.` : "Complete Self Discovery to score this." },
    { k: "problem", label: "Problem evidence", w: 15, v: problemScore, why: evidencedOpportunities.length ? `${evidencedOpportunities.length} opportunity card(s) with a real, non-assumption evidence note.` : "Add an evidence note (not just a guess) to an Opportunity Card." },
    { k: "customer", label: "Customer evidence", w: 12, v: customerScore, why: metExperiments.length ? `${metExperiments.length} experiment(s) explicitly marked as having met their own threshold.` : "Run an experiment and mark whether it met its threshold." },
    { k: "validation", label: "Validation quality", w: 15, v: validationScore, why: runExperiments.length ? `${runExperiments.length} experiment(s) actually run with a recorded result against a threshold.` : "Record a result for an experiment — a defined-but-unrun experiment doesn't count." },
    { k: "market", label: "Market understanding", w: 10, v: marketScore, why: qualifyingEvidence.length ? `${qualifyingEvidence.length} sourced, non-assumption evidence item(s) logged.` : "Add an evidence item with a real publisher or source URL — assumption-class or unsourced entries don't count." },
    { k: "unit", label: "Unit economics", w: 13, v: unitScore, why: unitWhy },
    { k: "reg", label: "Regulatory readiness", w: 8, v: 0, why: "No regulatory review logged yet." },
    { k: "risk", label: "Risk awareness", w: 6, v: riskScore, why: risksWithMitigation.length ? `${risksWithMitigation.length} risk(s) logged with a real mitigation.` : "Add a risk with an actual mitigation, not just a label." },
    { k: "capital", label: "Capital sufficiency", w: 6, v: capitalScore, why: "Not modelled in this build yet — no funding, runway or capital plan is captured, so this cannot be scored honestly." },
  ];
  const total = Math.round(dims.reduce((s, d) => s + d.v * d.w, 0) / dims.reduce((s, d) => s + d.w, 0));
  return { total, dims };
}

// ---------- gamification ----------
export type Badge = { key: string; label: string; earned: boolean; why: string };

export async function computeGamification(userId: string) {
  const activity = await listActivity(userId);
  const profile = await getFounderProfile(userId);
  const opportunities = await listOpportunities(userId);
  const experiments = await listExperiments(userId);
  const evidence = await listEvidence(userId);
  const risks = await listRisks(userId);
  const base = await getScenario(userId, "base");

  const days = new Set(activity.map(a => a.createdAt.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    else if (streak === 0 && key === new Date().toISOString().slice(0, 10)) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const yKey = cursor.toISOString().slice(0, 10);
      if (!days.has(yKey)) break;
    } else break;
  }

  const evidencedOpportunities = opportunities.filter(o => (o.evidenceNote || "").trim().length > 0 && o.evidenceClass !== "assumption");
  const metExperiments = experiments.filter(e => e.metThreshold === "yes");
  const risksWithMitigation = risks.filter(r => (r.mitigation || "").trim().length > 3);
  const qualifyingEvidence = evidence.filter(e => e.evClass !== "assumption" && ((e.publisher || "").trim().length > 0 || (e.url || "").trim().length > 0));

  const badges: Badge[] = [
    { key: "fit_mapped", label: "Fit Mapped", earned: !!profile, why: "Complete Self Discovery." },
    { key: "first_idea", label: "First Idea", earned: opportunities.length >= 1, why: "Add one Opportunity Card." },
    { key: "idea_sprinter", label: "Idea Sprinter", earned: opportunities.length >= 3, why: `Add 3 Opportunity Cards (${opportunities.length}/3).` },
    { key: "evidence_backed", label: "Evidence-Backed", earned: evidencedOpportunities.length >= 1, why: "Give an Opportunity Card a real, non-assumption evidence note." },
    { key: "first_experiment", label: "First Experiment", earned: experiments.length >= 1, why: "Define one experiment in the Validation Quest Lab." },
    { key: "validator", label: "Validator", earned: metExperiments.length >= 1, why: "Get one experiment to actually meet its stated threshold." },
    { key: "market_researcher", label: "Market Researcher", earned: qualifyingEvidence.length >= 1, why: "Log a sourced, non-assumption evidence item (a real publisher or URL)." },
    { key: "risk_aware", label: "Risk Aware", earned: risksWithMitigation.length >= 1, why: "Log a risk with a real mitigation." },
    { key: "money_modeled", label: "Money Modeled", earned: base.price > 0 && base.startUnits > 0, why: "Enter base-case price and starting units in Money Lab." },
  ];
  const earnedCount = badges.filter(b => b.earned).length;

  return {
    streak,
    totalActions: activity.length,
    badges,
    earnedCount,
    badgeTotal: badges.length,
    recentActivity: activity.slice(0, 8),
  };
}

// ---------- comparable companies ----------
const COMPARABLE_COLS = `id, user_id AS "userId", opportunity_id AS "opportunityId", name, source_url AS "sourceUrl",
  source_publisher AS "sourcePublisher", status, status_note AS "statusNote", last_rechecked AS "lastRechecked", notes, created_at AS "createdAt"`;

export async function listComparableCompanies(userId: string): Promise<ComparableCompany[]> {
  return q<ComparableCompany>(`SELECT ${COMPARABLE_COLS} FROM comparable_companies WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}
export async function createComparableCompany(userId: string, input: Omit<ComparableCompany, "id" | "userId" | "createdAt">): Promise<ComparableCompany> {
  const id = newId();
  await q(
    `INSERT INTO comparable_companies (id,user_id,opportunity_id,name,source_url,source_publisher,status,status_note,last_rechecked,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, userId, input.opportunityId || "", input.name, input.sourceUrl || "", input.sourcePublisher || "", input.status || "unknown", input.statusNote || "", input.lastRechecked || "", input.notes || "", now()]
  );
  await logActivity(userId, "comparable_added", input.name);
  return (await qOne<ComparableCompany>(`SELECT ${COMPARABLE_COLS} FROM comparable_companies WHERE id = $1`, [id]))!;
}
export async function recheckComparableCompany(id: string, userId: string, input: { status: ComparableCompany["status"]; statusNote: string }) {
  await q(`UPDATE comparable_companies SET status = $1, status_note = $2, last_rechecked = $3 WHERE id = $4 AND user_id = $5`, [input.status, input.statusNote, now(), id, userId]);
}
export async function deleteComparableCompany(id: string, userId: string) {
  await q(`DELETE FROM comparable_companies WHERE id = $1 AND user_id = $2`, [id, userId]);
}
export async function staleComparables(userId: string): Promise<ComparableCompany[]> {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const all = await listComparableCompanies(userId);
  return all.filter((c) => {
    const checked = c.lastRechecked ? Date.parse(c.lastRechecked) : Date.parse(c.createdAt);
    return !Number.isFinite(checked) || checked < cutoff;
  });
}

// ---------- ecosystem contacts ----------
const ECOSYSTEM_COLS = `id, user_id AS "userId", opportunity_id AS "opportunityId", kind, name, focus, stage, source_url AS "sourceUrl",
  application_status AS "applicationStatus", deadline, notes, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listEcosystemContacts(userId: string): Promise<EcosystemContact[]> {
  return q<EcosystemContact>(`SELECT ${ECOSYSTEM_COLS} FROM ecosystem_contacts WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}
export async function createEcosystemContact(userId: string, input: Omit<EcosystemContact, "id" | "userId" | "createdAt" | "updatedAt">): Promise<EcosystemContact> {
  const id = newId();
  await q(
    `INSERT INTO ecosystem_contacts (id,user_id,opportunity_id,kind,name,focus,stage,source_url,application_status,deadline,notes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, userId, input.opportunityId || "", input.kind, input.name, input.focus || "", input.stage || "", input.sourceUrl || "", input.applicationStatus || "not_started", input.deadline || "", input.notes || "", now(), now()]
  );
  await logActivity(userId, "ecosystem_contact_added", input.name);
  return (await qOne<EcosystemContact>(`SELECT ${ECOSYSTEM_COLS} FROM ecosystem_contacts WHERE id = $1`, [id]))!;
}
export async function updateEcosystemContactStatus(id: string, userId: string, applicationStatus: EcosystemContact["applicationStatus"]) {
  await q(`UPDATE ecosystem_contacts SET application_status = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`, [applicationStatus, now(), id, userId]);
}
export async function deleteEcosystemContact(id: string, userId: string) {
  await q(`DELETE FROM ecosystem_contacts WHERE id = $1 AND user_id = $2`, [id, userId]);
}
export async function upcomingDeadlines(userId: string) {
  const in21 = Date.now() + 21 * 24 * 60 * 60 * 1000;
  const all = await listEcosystemContacts(userId);
  return all.filter((c) => {
    if (!c.deadline || ["applied", "in_review", "awarded", "rejected", "declined"].includes(c.applicationStatus)) return false;
    const d = Date.parse(c.deadline);
    return Number.isFinite(d) && d <= in21;
  });
}

// ---------- business plan ----------
export async function getBusinessPlan(userId: string): Promise<BusinessPlan | undefined> {
  const row = await qOne<BusinessPlan>(
    `SELECT user_id AS "userId", executive_summary AS "executiveSummary", market_section AS "marketSection", business_model_section AS "businessModelSection",
      go_to_market_section AS "goToMarketSection", ops_section AS "opsSection", updated_at AS "updatedAt" FROM business_plan WHERE user_id = $1`,
    [userId]
  );
  return row ?? undefined;
}
export async function saveBusinessPlan(userId: string, input: Omit<BusinessPlan, "userId" | "updatedAt">) {
  const existing = await getBusinessPlan(userId);
  if (existing) {
    await q(
      `UPDATE business_plan SET executive_summary=$1, market_section=$2, business_model_section=$3, go_to_market_section=$4, ops_section=$5, updated_at=$6 WHERE user_id=$7`,
      [input.executiveSummary, input.marketSection, input.businessModelSection, input.goToMarketSection, input.opsSection, now(), userId]
    );
  } else {
    await q(
      `INSERT INTO business_plan (user_id,executive_summary,market_section,business_model_section,go_to_market_section,ops_section,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, input.executiveSummary, input.marketSection, input.businessModelSection, input.goToMarketSection, input.opsSection, now()]
    );
  }
}
export async function assemblePlanDraft(userId: string) {
  const profile = await getFounderProfile(userId);
  const idea = await getActiveOpportunity(userId);
  const allEvidence = await listEvidence(userId);
  const allExperiments = await listExperiments(userId);
  const evidence = idea ? allEvidence.filter((e) => e.opportunityId === idea.id) : allEvidence;
  const experiments = idea ? allExperiments.filter((e) => e.opportunityId === idea.id) : allExperiments;
  const base = await getScenario(userId, "base");

  const executiveSummary = idea
    ? `${idea.title} — serving ${idea.customer || "[customer not yet defined in Opportunity Forest]"}. Problem, as stated: ${idea.problem || "[not yet defined]"}.`
    : "[No active idea — add one in Opportunity Forest, then return here.]";

  const marketSection = evidence.length
    ? evidence.map((e) => `• ${e.claim}${e.metric ? ` — ${e.metric}` : ""} (${EVIDENCE_CLASS_LABEL(e.evClass)}${e.publisher ? `, ${e.publisher}` : ""})`).join("\n")
    : "[No evidence logged yet for this idea — add sourced claims in the Evidence Lab.]";

  const businessModelSection = base.price > 0
    ? `Price per unit: ₹${base.price}. Base-case starting units: ${base.startUnits}. COGS: ${Math.round(base.cogsPct * 100)}% of revenue. Fixed monthly cost: ₹${base.fixedMonthly}.`
    : "[No base-case pricing entered yet — fill in Money Lab, then return here.]";

  const goToMarketSection = experiments.length
    ? experiments.map((e) => `• ${e.name}: ${e.method || "[method not set]"} — success = ${e.threshold || "[threshold not set]"}${e.metThreshold === "yes" ? " — MET" : e.metThreshold === "no" ? " — NOT MET" : ""}`).join("\n")
    : "[No validation experiments defined yet — add one in the Validation Quest Lab.]";

  const risks = await listRisks(userId);
  const opsSection = risks.length
    ? risks.map((r) => `• ${r.risk} (${r.severity}) — mitigation: ${r.mitigation || "[none logged]"}`).join("\n")
    : "[No risks logged yet — add them in the Evidence Passport risk register.]";

  return { executiveSummary, marketSection, businessModelSection, goToMarketSection, opsSection };
}
function EVIDENCE_CLASS_LABEL(cls: string) {
  const labels: Record<string, string> = {
    official: "official source", company: "company disclosure", user: "your own input",
    derived: "derived calculation", estimate: "external estimate", assumption: "assumption",
    forecast: "forecast", analyst: "analyst interpretation", notfound: "evidence not found",
  };
  return labels[cls] || cls;
}
export async function planConsistencyChecks(userId: string) {
  const idea = await getActiveOpportunity(userId);
  const base = await getScenario(userId, "base");
  const allEvidence = await listEvidence(userId);
  const allExperiments = await listExperiments(userId);
  const evidence = idea ? allEvidence.filter((e) => e.opportunityId === idea.id) : allEvidence;
  const experiments = idea ? allExperiments.filter((e) => e.opportunityId === idea.id) : allExperiments;
  const conflicts = await findEvidenceConflicts(userId);
  const checks: { ok: boolean; label: string }[] = [];

  checks.push({
    ok: !!idea,
    label: idea ? `Active idea set: "${idea.title}".` : "No active idea selected — Opportunity Forest and Idea Arena won't have anything to check against.",
  });
  checks.push({
    ok: base.price > 0,
    label: base.price > 0 ? `Money Lab base-case price (₹${base.price}) is set.` : "Money Lab base-case price is still ₹0 — the plan can't state a business model without it.",
  });
  checks.push({
    ok: evidence.length > 0,
    label: evidence.length > 0 ? `${evidence.length} evidence item(s) linked to this idea back the Market section.` : "No evidence is linked to this idea yet — the Market section will be empty.",
  });
  checks.push({
    ok: experiments.some((e) => e.metThreshold === "yes"),
    label: experiments.some((e) => e.metThreshold === "yes")
      ? "At least one experiment has explicitly met its threshold — there is real validation behind this plan."
      : "No experiment has been marked as having met its threshold yet — this plan is not yet demand-validated.",
  });
  checks.push({
    ok: conflicts.length === 0,
    label: conflicts.length === 0 ? "No conflicting evidence entries detected." : `${conflicts.length} claim(s) have conflicting evidence entries — resolve in the Evidence Lab before treating this plan as consistent.`,
  });
  return checks;
}

// ---------- Operate / Monitor — plan-vs-actual ----------
export async function listActuals(userId: string): Promise<ActualsEntry[]> {
  return q<ActualsEntry>(
    `SELECT id, user_id AS "userId", opportunity_id AS "opportunityId", period, revenue, customers, costs, notes, created_at AS "createdAt" FROM actuals_log WHERE user_id = $1 ORDER BY period ASC`,
    [userId]
  );
}
export async function upsertActuals(userId: string, input: Omit<ActualsEntry, "id" | "userId" | "createdAt">) {
  const existing = await qOne<{ id: string }>(`SELECT id FROM actuals_log WHERE user_id = $1 AND period = $2`, [userId, input.period]);
  if (existing) {
    await q(`UPDATE actuals_log SET revenue=$1, customers=$2, costs=$3, notes=$4, opportunity_id=$5 WHERE id=$6`,
      [input.revenue, input.customers, input.costs, input.notes || "", input.opportunityId || "", existing.id]);
  } else {
    await q(`INSERT INTO actuals_log (id,user_id,opportunity_id,period,revenue,customers,costs,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [newId(), userId, input.opportunityId || "", input.period, input.revenue, input.customers, input.costs, input.notes || "", now()]);
  }
  await logActivity(userId, "actuals_logged", input.period);
}
export async function deleteActuals(id: string, userId: string) {
  await q(`DELETE FROM actuals_log WHERE id = $1 AND user_id = $2`, [id, userId]);
}
export async function planVsActual(userId: string) {
  const actuals = await listActuals(userId);
  const base = await getScenario(userId, "base");
  const projection = computeMonthlyProjection(base, Math.max(actuals.length, 1));
  const forecastByMonth = projection.rows.map((r) => ({ revenue: r.revenue }));
  return actuals.map((a, i) => {
    const forecastRevenue = forecastByMonth[i]?.revenue ?? 0;
    const varianceRevenue = forecastRevenue > 0 ? ((a.revenue - forecastRevenue) / forecastRevenue) * 100 : null;
    return { ...a, forecastRevenue, varianceRevenuePct: varianceRevenue };
  });
}

// ---------- India Ledger — DPR-lite ----------
export async function getDprInputs(userId: string): Promise<DprInputs> {
  const cols = `user_id AS "userId", land_building AS "landBuilding", machinery, working_capital_margin AS "workingCapitalMargin",
    preliminary_expenses AS "preliminaryExpenses", contingency, promoter_contribution AS "promoterContribution",
    term_loan_amount AS "termLoanAmount", term_loan_rate_pct AS "termLoanRatePct", term_loan_tenure_years AS "termLoanTenureYears",
    wc_loan_amount AS "wcLoanAmount", wc_loan_rate_pct AS "wcLoanRatePct", updated_at AS "updatedAt"`;
  const existing = await qOne<DprInputs>(`SELECT ${cols} FROM dpr_inputs WHERE user_id = $1`, [userId]);
  if (existing) return existing;
  await q(
    `INSERT INTO dpr_inputs (user_id,land_building,machinery,working_capital_margin,preliminary_expenses,contingency,promoter_contribution,term_loan_amount,term_loan_rate_pct,term_loan_tenure_years,wc_loan_amount,wc_loan_rate_pct,updated_at) VALUES ($1,0,0,0,0,0,0,0,0,0,0,0,$2)`,
    [userId, now()]
  );
  return {
    userId, landBuilding: 0, machinery: 0, workingCapitalMargin: 0, preliminaryExpenses: 0,
    contingency: 0, promoterContribution: 0, termLoanAmount: 0, termLoanRatePct: 0,
    termLoanTenureYears: 0, wcLoanAmount: 0, wcLoanRatePct: 0, updatedAt: now().toISOString(),
  };
}
export async function saveDprInputs(userId: string, input: Partial<Omit<DprInputs, "userId" | "updatedAt">>) {
  await getDprInputs(userId); // ensure row exists
  const colMap: Record<string, string> = {
    landBuilding: "land_building", machinery: "machinery", workingCapitalMargin: "working_capital_margin",
    preliminaryExpenses: "preliminary_expenses", contingency: "contingency", promoterContribution: "promoter_contribution",
    termLoanAmount: "term_loan_amount", termLoanRatePct: "term_loan_rate_pct", termLoanTenureYears: "term_loan_tenure_years",
    wcLoanAmount: "wc_loan_amount", wcLoanRatePct: "wc_loan_rate_pct",
  };
  const cols = Object.keys(input);
  if (!cols.length) return;
  const setClause = cols.map((c, i) => `${colMap[c]} = $${i + 1}`).join(", ");
  const values = cols.map((c) => (input as Record<string, number>)[c]);
  await q(`UPDATE dpr_inputs SET ${setClause}, updated_at = $${cols.length + 1} WHERE user_id = $${cols.length + 2}`, [...values, now(), userId]);
}
function emiSchedule(principal: number, annualRatePct: number, years: number) {
  if (principal <= 0 || years <= 0) return { emi: 0, rows: [] as { year: number; interest: number; principal: number; balance: number }[] };
  const months = Math.round(years * 12);
  const r = annualRatePct / 100 / 12;
  const emi = r > 0 ? (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1) : principal / months;
  let balance = principal;
  const yearly: { year: number; interest: number; principal: number; balance: number }[] = [];
  for (let y = 1; y <= Math.ceil(years); y++) {
    let yInterest = 0, yPrincipal = 0;
    for (let m = 1; m <= 12 && balance > 0.01; m++) {
      const interest = balance * r;
      const princ = Math.min(balance, emi - interest);
      balance -= princ;
      yInterest += interest;
      yPrincipal += princ;
    }
    yearly.push({ year: y, interest: yInterest, principal: yPrincipal, balance: Math.max(0, balance) });
  }
  return { emi, rows: yearly };
}
export async function computeDpr(userId: string) {
  const inp = await getDprInputs(userId);
  const base = await getScenario(userId, "base");
  const projectCost = inp.landBuilding + inp.machinery + inp.workingCapitalMargin + inp.preliminaryExpenses + inp.contingency;
  const meansOfFinance = inp.promoterContribution + inp.termLoanAmount + inp.wcLoanAmount;
  const reconciled = Math.abs(projectCost - meansOfFinance) < 1;
  const schedule = emiSchedule(inp.termLoanAmount, inp.termLoanRatePct, inp.termLoanTenureYears);

  const annualNet = computeMonthlyProjection(base, 12).rows.reduce((sum, r) => sum + r.net, 0);
  const year1 = schedule.rows[0];
  const dscr = year1 && (year1.interest + year1.principal) > 0
    ? (annualNet + (year1?.interest || 0)) / (year1.interest + year1.principal)
    : null;

  return { projectCost, meansOfFinance, reconciled, schedule, annualNet, dscr, emi: schedule.emi };
}

// ---------- Discovery & validation intelligence ----------
export async function computeDiscoveryReadiness(userId: string) {
  const profile = await getFounderProfile(userId);
  const idea = await getActiveOpportunity(userId);
  const dims = [
    { k: "self", label: "Self Discovery", v: profile ? Math.min(100, [profile.strengths, profile.develop, profile.time, profile.capital, profile.categories].filter(f => (f || "").trim().length > 3).length * 20) : 0,
      next: profile ? "Refine your Founder Fit Map as you learn more." : "Complete Self Discovery — strengths, constraints, categories of interest." },
    { k: "idea", label: "Idea defined", v: idea ? (idea.customer && idea.problem ? 100 : 50) : 0,
      next: idea ? (idea.customer && idea.problem ? "Idea is fully defined." : "Fill in the missing customer or problem statement.") : "Add or generate an idea in Opportunity Forest." },
    { k: "context", label: "Founder-idea fit signal", v: profile && idea ? (profile.categories.toLowerCase().includes((idea.title || "").split(" ")[0]?.toLowerCase() || " ") ? 100 : 60) : 0,
      next: profile && idea ? "Keep checking this idea against your own stated strengths and interests as you learn more." : "Complete both Self Discovery and an Opportunity Card to see this signal." },
  ];
  const total = Math.round(dims.reduce((s, d) => s + d.v, 0) / dims.length);
  return { total, dims };
}

// ---------- Guide ----------
export type GuideStepRow = { userId: string; stepId: string; fields: Record<string, string>; items: Record<string, unknown[]>; notes: string; updatedAt: string };
export async function getGuideStep(userId: string, stepId: string): Promise<GuideStepRow> {
  const row = await qOne<{ userId: string; stepId: string; fieldsJson: string; itemsJson: string; notes: string; updatedAt: string }>(
    `SELECT user_id AS "userId", step_id AS "stepId", fields_json AS "fieldsJson", items_json AS "itemsJson", notes, updated_at AS "updatedAt" FROM guide_steps WHERE user_id = $1 AND step_id = $2`,
    [userId, stepId]
  );
  if (!row) return { userId, stepId, fields: {}, items: {}, notes: "", updatedAt: "" };
  let fields: Record<string, string> = {};
  let items: Record<string, unknown[]> = {};
  try { fields = JSON.parse(row.fieldsJson) || {}; } catch { fields = {}; }
  try { items = JSON.parse(row.itemsJson) || {}; } catch { items = {}; }
  return { userId, stepId, fields, items, notes: row.notes, updatedAt: row.updatedAt };
}
export async function getAllGuideSteps(userId: string): Promise<Record<string, GuideStepRow>> {
  const rows = await q<{ userId: string; stepId: string; fieldsJson: string; itemsJson: string; notes: string; updatedAt: string }>(
    `SELECT user_id AS "userId", step_id AS "stepId", fields_json AS "fieldsJson", items_json AS "itemsJson", notes, updated_at AS "updatedAt" FROM guide_steps WHERE user_id = $1`,
    [userId]
  );
  const out: Record<string, GuideStepRow> = {};
  for (const row of rows) {
    let fields: Record<string, string> = {};
    let items: Record<string, unknown[]> = {};
    try { fields = JSON.parse(row.fieldsJson) || {}; } catch { fields = {}; }
    try { items = JSON.parse(row.itemsJson) || {}; } catch { items = {}; }
    out[row.stepId] = { userId, stepId: row.stepId, fields, items, notes: row.notes, updatedAt: row.updatedAt };
  }
  return out;
}
export async function saveGuideStepFields(userId: string, stepId: string, fields: Record<string, string>) {
  const existing = await getGuideStep(userId, stepId);
  const merged = { ...existing.fields, ...fields };
  await upsertGuideStep(userId, stepId, merged, existing.items, existing.notes);
}
export async function saveGuideStepItems(userId: string, stepId: string, listKey: string, items: unknown[]) {
  const existing = await getGuideStep(userId, stepId);
  const mergedItems = { ...existing.items, [listKey]: items };
  await upsertGuideStep(userId, stepId, existing.fields, mergedItems, existing.notes);
}
export async function saveGuideStepNotes(userId: string, stepId: string, notes: string) {
  const existing = await getGuideStep(userId, stepId);
  await upsertGuideStep(userId, stepId, existing.fields, existing.items, notes);
}
async function upsertGuideStep(userId: string, stepId: string, fields: Record<string, string>, items: Record<string, unknown[]>, notes: string) {
  const fieldsJson = JSON.stringify(fields);
  const itemsJson = JSON.stringify(items);
  const existing = await qOne<{ id: string }>(`SELECT id FROM guide_steps WHERE user_id = $1 AND step_id = $2`, [userId, stepId]);
  if (existing) {
    await q(`UPDATE guide_steps SET fields_json=$1, items_json=$2, notes=$3, updated_at=$4 WHERE id=$5`, [fieldsJson, itemsJson, notes, now(), existing.id]);
  } else {
    await q(`INSERT INTO guide_steps (id,user_id,step_id,fields_json,items_json,notes,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [newId(), userId, stepId, fieldsJson, itemsJson, notes, now()]);
  }
}
export function guideStepHasContent(row: GuideStepRow): boolean {
  const hasField = Object.values(row.fields).some((v) => (v || "").trim().length > 0);
  const hasItems = Object.values(row.items).some((arr) => Array.isArray(arr) && arr.length > 0);
  return hasField || hasItems;
}

export type GuideMeta = { businessName: string; templateLabel: string; notes: string; customer: string; problem: string; mission: string };
export async function getGuideMeta(userId: string): Promise<GuideMeta> {
  const row = await qOne<GuideMeta>(
    `SELECT business_name AS "businessName", template_label AS "templateLabel", notes, customer, problem, mission FROM guide_meta WHERE user_id = $1`,
    [userId]
  );
  return row || { businessName: "", templateLabel: "", notes: "", customer: "", problem: "", mission: "" };
}
export async function saveGuideMeta(userId: string, meta: GuideMeta) {
  const existing = await qOne<{ userId: string }>(`SELECT user_id AS "userId" FROM guide_meta WHERE user_id = $1`, [userId]);
  if (existing) {
    await q(`UPDATE guide_meta SET business_name=$1, template_label=$2, notes=$3, customer=$4, problem=$5, mission=$6, updated_at=$7 WHERE user_id=$8`,
      [meta.businessName, meta.templateLabel, meta.notes, meta.customer, meta.problem, meta.mission, now(), userId]);
  } else {
    await q(`INSERT INTO guide_meta (user_id,business_name,template_label,notes,customer,problem,mission,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, meta.businessName, meta.templateLabel, meta.notes, meta.customer, meta.problem, meta.mission, now()]);
  }
}

export async function computeValidationReadiness(userId: string) {
  const idea = await getActiveOpportunity(userId);
  const allExperiments = await listExperiments(userId);
  const experiments = idea ? allExperiments.filter((e) => e.opportunityId === idea.id) : allExperiments;
  const defined = experiments.filter((e) => e.threshold && e.stopRule);
  const run = experiments.filter((e) => (e.result || "").trim().length > 0);
  const met = experiments.filter((e) => e.metThreshold === "yes");
  const dims = [
    { k: "designed", label: "Experiments designed", v: Math.min(100, defined.length * 34),
      next: defined.length ? `${defined.length} experiment(s) have both a threshold and a stop rule.` : "Define an experiment with an explicit threshold and stop rule." },
    { k: "run", label: "Experiments actually run", v: Math.min(100, run.length * 34),
      next: run.length ? `${run.length} experiment(s) have a recorded result.` : "Run a defined experiment and record its result." },
    { k: "cleared", label: "Threshold cleared", v: Math.min(100, met.length * 50),
      next: met.length ? `${met.length} experiment(s) explicitly met their own threshold.` : "Mark whether a recorded result met its stated threshold." },
  ];
  const total = Math.round(dims.reduce((s, d) => s + d.v, 0) / dims.length);
  return { total, dims };
}

export { tx };
