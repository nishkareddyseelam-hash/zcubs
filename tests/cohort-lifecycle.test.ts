// Cohort transfer/deferral/graduation (D-016, docs/DECISION_LOG.md). Run
// with: npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as inst from "../src/lib/institutional";
import * as repo from "../src/lib/repo";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

async function setUp(prefix: string, cohortCount = 2) {
  const owner = await makeUser(`${prefix}_owner_${Date.now()}@example.com`);
  const founder = await makeUser(`${prefix}_founder_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `${prefix} Institution ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: `${prefix} Programme` });
  const cohorts = [];
  for (let i = 0; i < cohortCount; i++) cohorts.push(await inst.createCohort(owner, programme.id, `${prefix} Cohort ${i}`));
  await inst.enrolFounderInCohort(owner, cohorts[0].id, founder);
  const membership = (await inst.listCohortMembers(cohorts[0].id))[0];
  return { owner, founder, institution, programme, cohorts, membership };
}

test("D-016: a cohort membership defaults to active, and only a real programme role holder can change its status", async () => {
  const { owner, membership } = await setUp("lifecycle_status");
  const outsider = await (async () => {
    const id = newId();
    await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,'Outsider',$2,'x','founder',$3)`, [id, `lifecycle_outsider_${Date.now()}@example.com`, now()]);
    return id;
  })();

  await assert.rejects(() => inst.updateCohortMembershipStatus(outsider, membership.id, "graduated"));

  await inst.updateCohortMembershipStatus(owner, membership.id, "graduated");
  const updated = (await inst.listCohortMembers(membership.cohortId))[0];
  assert.equal(updated.status, "graduated");
});

test("D-016: updateCohortMembershipStatus rejects an invalid status", async () => {
  const { owner, membership } = await setUp("lifecycle_invalid");
  await assert.rejects(() => inst.updateCohortMembershipStatus(owner, membership.id, "bogus" as inst.CohortMembershipStatus));
});

test("D-016: transferring a founder to a same-programme cohort withdraws the old membership and activates the new one — and future Opportunities scope to the new cohort", async () => {
  const { owner, founder, cohorts, membership } = await setUp("lifecycle_transfer");
  await inst.transferCohortMembership(owner, membership.id, cohorts[1].id);

  const oldMembers = await inst.listCohortMembers(cohorts[0].id);
  assert.equal(oldMembers[0].status, "withdrawn");
  const newMembers = await inst.listCohortMembers(cohorts[1].id);
  assert.equal(newMembers[0].status, "active");

  const context = await inst.getFounderProgrammeContext(founder);
  assert.equal(context!.cohort.id, cohorts[1].id);

  const opp = await repo.createOpportunity(founder, {
    title: "Post-transfer idea", customer: "c", problem: "p", evidenceClass: "assumption", evidenceNote: "",
    difficulty: "medium", capital: "low", mission: "", dimFit: 0, dimEvidence: 0, dimCustomer: 0,
    dimDefensibility: 0, dimCapital: 0, dimMargin: 0, dimScale: 0, dimSocial: 0,
  });
  assert.equal(opp.cohortId, cohorts[1].id);
});

test("D-016: transfer across different programmes is rejected (an actor without a role on the target cohort is rejected on RBAC alone — defense in depth), and a non-active membership cannot be transferred", async () => {
  const a = await setUp("lifecycle_cross_a", 1);
  const b = await setUp("lifecycle_cross_b", 1);
  await assert.rejects(
    () => inst.transferCohortMembership(a.owner, a.membership.id, b.cohorts[0].id),
    /Forbidden/,
  );
  // Even WITH a real role on both cohorts (e.g. a platform admin), crossing
  // programmes is still rejected on its own merits.
  await inst.grantRole(a.owner, "cohort", b.cohorts[0].id, "programme_manager", a.owner);
  await assert.rejects(
    () => inst.transferCohortMembership(a.owner, a.membership.id, b.cohorts[0].id),
    /same programme/,
  );

  const { owner, cohorts, membership } = await setUp("lifecycle_notactive", 2);
  await inst.updateCohortMembershipStatus(owner, membership.id, "withdrawn");
  await assert.rejects(
    () => inst.transferCohortMembership(owner, membership.id, cohorts[1].id),
    /active/,
  );
});

test("D-016: listCohortMembersWithNames surfaces the founder's real name/email alongside their status", async () => {
  const { founder, cohorts } = await setUp("lifecycle_names", 1);
  const members = await inst.listCohortMembersWithNames(cohorts[0].id);
  assert.equal(members.length, 1);
  assert.equal(members[0].userId, founder);
  assert.ok(members[0].userEmail.includes("lifecycle_names_founder"));
});
