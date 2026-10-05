// Evaluation rubric & scoring (D-015, docs/DECISION_LOG.md). Run with:
// npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
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

async function setUpProgramme(prefix: string) {
  const owner = await makeUser(`${prefix}_owner_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `${prefix} Institution ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: `${prefix} Programme` });
  return { owner, institution, programme };
}

test("D-015: a programme starts with no rubric — getRubricForProgramme returns undefined, nothing is pre-seeded", async () => {
  const { programme } = await setUpProgramme("rubric_none");
  const rubric = await inst.getRubricForProgramme(programme.id);
  assert.equal(rubric, undefined);
});

test("D-015: adding a criterion lazily creates the rubric, and only a real programme role holder can add one", async () => {
  const { owner, programme } = await setUpProgramme("rubric_add");
  const outsider = await makeUser(`rubric_outsider_${Date.now()}@example.com`);

  await assert.rejects(() => inst.addEvaluationCriterion(outsider, programme.id, { label: "Should fail" }));

  const criterion = await inst.addEvaluationCriterion(owner, programme.id, { label: "Founder-market fit", weight: 3 });
  assert.equal(criterion.label, "Founder-market fit");
  assert.equal(criterion.weight, 3);
  assert.equal(criterion.kind, "human_judgement");

  const rubric = await inst.getRubricForProgramme(programme.id);
  assert.ok(rubric);
  assert.equal(rubric!.criteria.length, 1);
});

test("D-015: submitEvaluation persists real per-criterion scores, and listEvaluationsForApplication computes a weighted average from real weights", async () => {
  const { owner, programme } = await setUpProgramme("rubric_score");
  const founder = await makeUser(`rubric_founder_${Date.now()}@example.com`);
  const evaluator = await makeUser(`rubric_evaluator_${Date.now()}@example.com`);

  const c1 = await inst.addEvaluationCriterion(owner, programme.id, { label: "Problem clarity", weight: 1 });
  const c2 = await inst.addEvaluationCriterion(owner, programme.id, { label: "Evidence quality", weight: 3 });

  const formId = await inst.createApplicationForm(owner, programme.id, [{ label: "Idea", fieldType: "textarea", required: true }]);
  const form = (await inst.getApplicationForm(programme.id))!;
  const applicationId = await inst.submitApplication(founder, formId, { [form.questions[0].id]: "An idea" });
  await inst.assignEvaluator(owner, applicationId, evaluator);

  // weighted average = (1*4 + 3*8) / (1+3) = 28/4 = 7
  await inst.submitEvaluation(evaluator, applicationId, "Solid application", [
    { criterionId: c1.id, score: 4 },
    { criterionId: c2.id, score: 8 },
  ]);

  const evaluations = await inst.listEvaluationsForApplication(applicationId);
  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0].reasoning, "Solid application");
  assert.equal(evaluations[0].scores.length, 2);
  assert.equal(evaluations[0].weightedTotal, 7);
});

test("D-015: an evaluation with no scores at all (reasoning-only) has weightedTotal null, never a fabricated 0", async () => {
  const { owner, programme } = await setUpProgramme("rubric_noscore");
  const founder = await makeUser(`rubric_noscore_founder_${Date.now()}@example.com`);
  const evaluator = await makeUser(`rubric_noscore_evaluator_${Date.now()}@example.com`);
  const formId = await inst.createApplicationForm(owner, programme.id, [{ label: "Idea", fieldType: "textarea", required: true }]);
  const form = (await inst.getApplicationForm(programme.id))!;
  const applicationId = await inst.submitApplication(founder, formId, { [form.questions[0].id]: "An idea" });
  await inst.assignEvaluator(owner, applicationId, evaluator);

  await inst.submitEvaluation(evaluator, applicationId, "No rubric scored, just reasoning", []);
  const evaluations = await inst.listEvaluationsForApplication(applicationId);
  assert.equal(evaluations[0].weightedTotal, null);
});

test("D-015: removeEvaluationCriterion only removes a criterion that actually belongs to that programme's own rubric", async () => {
  const { owner, programme } = await setUpProgramme("rubric_remove_a");
  const { owner: owner2, programme: programme2 } = await setUpProgramme("rubric_remove_b");
  const criterion = await inst.addEvaluationCriterion(owner, programme.id, { label: "To remove" });

  // Wrong programme (even with a role there) must not be able to remove another programme's criterion.
  await inst.removeEvaluationCriterion(owner2, programme2.id, criterion.id);
  const stillThere = await inst.getRubricForProgramme(programme.id);
  assert.equal(stillThere!.criteria.length, 1, "a criterion must not be removable via an unrelated programme's id");

  await inst.removeEvaluationCriterion(owner, programme.id, criterion.id);
  const afterReal = await inst.getRubricForProgramme(programme.id);
  assert.equal(afterReal!.criteria.length, 0);
});
