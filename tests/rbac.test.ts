// Cross-tenant / cross-role access-denial tests (spec section 39/34).
// Run with: npm test (node --test via tsx). Requires DATABASE_URL to point
// at a real Postgres with the schema applied (see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as inst from "../src/lib/institutional";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

test("an institution owner at Institution A cannot manage a programme at Institution B", async () => {
  const ownerA = await makeUser(`rbac_owner_a_${Date.now()}@example.com`);
  const ownerB = await makeUser(`rbac_owner_b_${Date.now()}@example.com`);
  const instA = await inst.createInstitution(ownerA, { name: `RBAC Test Inst A ${Date.now()}` });
  const instB = await inst.createInstitution(ownerB, { name: `RBAC Test Inst B ${Date.now()}` });
  const programmeB = await inst.createProgramme(ownerB, instB.id, { title: "B's programme" });

  await assert.rejects(
    () => inst.createCohort(ownerA, programmeB.id, "Should fail"),
    /Forbidden/,
    "Owner A must not be able to create a cohort under Institution B's programme"
  );
  // Sanity: Owner B (the real owner) CAN.
  const cohort = await inst.createCohort(ownerB, programmeB.id, "Owner B's cohort");
  assert.ok(cohort.id);
  void instA;
});

test("a programme manager role at one programme does not grant access to a sibling programme in the same institution", async () => {
  const owner = await makeUser(`rbac_owner_c_${Date.now()}@example.com`);
  const pm = await makeUser(`rbac_pm_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `RBAC Test Inst C ${Date.now()}` });
  const programme1 = await inst.createProgramme(owner, institution.id, { title: "Programme 1" });
  // pm only granted at programme1's scope (simulating a scoped role grant), not institution-wide.
  await inst.grantRole(pm, "programme", programme1.id, "programme_manager", owner);
  const programme2 = await inst.createProgramme(owner, institution.id, { title: "Programme 2" });

  await assert.rejects(
    () => inst.createCohort(pm, programme2.id, "Should fail — pm not scoped to programme2"),
    /Forbidden/
  );
  const cohort1 = await inst.createCohort(pm, programme1.id, "OK — pm is scoped here");
  assert.ok(cohort1.id);
});

test("an evaluator assigned to one application cannot submit an evaluation for an application they were never assigned to", async () => {
  const owner = await makeUser(`rbac_owner_d_${Date.now()}@example.com`);
  const evaluator = await makeUser(`rbac_eval_${Date.now()}@example.com`);
  const applicant1 = await makeUser(`rbac_app1_${Date.now()}@example.com`);
  const applicant2 = await makeUser(`rbac_app2_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `RBAC Test Inst D ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: "Eval Test Programme" });
  const formId = await inst.createApplicationForm(owner, programme.id, [{ label: "Why?", fieldType: "textarea" }]);
  const app1Id = await inst.submitApplication(applicant1, formId, { q1: "answer" });
  const app2Id = await inst.submitApplication(applicant2, formId, { q1: "answer" });
  await inst.assignEvaluator(owner, app1Id, evaluator);

  await assert.rejects(
    () => inst.submitEvaluation(evaluator, app2Id, "trying to evaluate an application I wasn't assigned", []),
    /Not assigned/
  );
  await inst.submitEvaluation(evaluator, app1Id, "Legit evaluation", []);
});

test("selection decisions are immutable — a second decision on the same application is rejected", async () => {
  const owner = await makeUser(`rbac_owner_e_${Date.now()}@example.com`);
  const applicant = await makeUser(`rbac_app_e_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `RBAC Test Inst E ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: "Immutability Test Programme" });
  const formId = await inst.createApplicationForm(owner, programme.id, [{ label: "Why?", fieldType: "textarea" }]);
  const appId = await inst.submitApplication(applicant, formId, { q1: "answer" });
  await inst.recordSelectionDecision(owner, appId, "not_selected", "First decision");

  await assert.rejects(
    () => inst.recordSelectionDecision(owner, appId, "selected", "Trying to overturn the decision"),
    /immutable/
  );
});
