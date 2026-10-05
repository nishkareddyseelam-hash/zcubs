// Cohort scoping of founder work (D-014, docs/DECISION_LOG.md). Run with:
// npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as repo from "../src/lib/repo";
import * as inst from "../src/lib/institutional";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

const BASE_OPP = {
  title: "Test idea", customer: "c", problem: "p", evidenceClass: "assumption", evidenceNote: "",
  difficulty: "medium", capital: "low", mission: "", dimFit: 0, dimEvidence: 0, dimCustomer: 0,
  dimDefensibility: 0, dimCapital: 0, dimMargin: 0, dimScale: 0, dimSocial: 0,
};

test("D-014: a founder with no cohort membership gets an Opportunity with NULL institution/programme/cohort IDs, same as before", async () => {
  const userId = await makeUser(`cohort_scope_none_${Date.now()}@example.com`);
  const opp = await repo.createOpportunity(userId, BASE_OPP);
  assert.equal(opp.institutionId, null);
  assert.equal(opp.programmeId, null);
  assert.equal(opp.cohortId, null);
});

test("D-014: a founder with a real, active cohort membership has new Opportunities auto-stamped with that cohort's real institution/programme/cohort IDs", async () => {
  const owner = await makeUser(`cohort_scope_owner_${Date.now()}@example.com`);
  const founder = await makeUser(`cohort_scope_founder_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `Scoping Test Institution ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: "Scoping Test Programme" });
  const cohort = await inst.createCohort(owner, programme.id, "Scoping Test Cohort");
  await inst.enrolFounderInCohort(owner, cohort.id, founder);

  const opp = await repo.createOpportunity(founder, BASE_OPP);
  assert.equal(opp.institutionId, institution.id);
  assert.equal(opp.programmeId, programme.id);
  assert.equal(opp.cohortId, cohort.id);
});

test("D-014: getFounderProgrammeContext resolves the full real chain, and returns undefined for a founder with no membership", async () => {
  const owner = await makeUser(`cohort_scope_owner2_${Date.now()}@example.com`);
  const founder = await makeUser(`cohort_scope_founder2_${Date.now()}@example.com`);
  const unenrolled = await makeUser(`cohort_scope_unenrolled_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `Context Test Institution ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: "Context Test Programme" });
  const cohort = await inst.createCohort(owner, programme.id, "Context Test Cohort");
  await inst.enrolFounderInCohort(owner, cohort.id, founder);

  const context = await inst.getFounderProgrammeContext(founder);
  assert.ok(context);
  assert.equal(context!.cohort.id, cohort.id);
  assert.equal(context!.programme.id, programme.id);
  assert.equal(context!.institution.id, institution.id);

  const noContext = await inst.getFounderProgrammeContext(unenrolled);
  assert.equal(noContext, undefined);
});
