// Faculty-enablement / train-the-trainer track (D-022, docs/DECISION_LOG.md).
// Run with: npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as inst from "../src/lib/institutional";
import * as facilitators from "../src/lib/facilitators";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

async function setup(prefix: string) {
  const owner = await makeUser(`${prefix}_owner_${Date.now()}@example.com`);
  const institution = await inst.createInstitution(owner, { name: `${prefix} Institution ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: `${prefix} Programme` });
  await inst.seedDefault14WeekJourney(programme.id, owner);
  const cohort = await inst.createCohort(owner, programme.id, `${prefix} Cohort`);
  return { owner, institution, programme, cohort };
}

test("D-022: only institution staff can grant the cohort_facilitator role, and only to an actual institution member", async () => {
  const { owner, institution } = await setup("Grant");
  const outsider = await makeUser(`facilitator_outsider_${Date.now()}@example.com`);
  const stranger = await makeUser(`facilitator_stranger_${Date.now()}@example.com`);

  await assert.rejects(() => facilitators.grantFacilitatorRole(outsider, institution.id, stranger), /Forbidden/);
  await assert.rejects(() => facilitators.grantFacilitatorRole(owner, institution.id, stranger), /isn't a member/);

  // Make the target a real institution member the same way createInstitution does, then grant.
  await q(`INSERT INTO institution_memberships (id,institution_id,user_id,status,joined_at) VALUES ($1,$2,$3,'active',$4)`, [newId(), institution.id, stranger, now()]);
  await facilitators.grantFacilitatorRole(owner, institution.id, stranger);
  const list = await facilitators.listFacilitators(institution.id);
  assert.ok(list.some((f) => f.userId === stranger));
});

test("D-022: a facilitator cannot log a session for a week they haven't acknowledged the guidance for", async () => {
  const { owner, institution, programme, cohort } = await setup("Gate");
  const staff = await makeUser(`facilitator_gate_${Date.now()}@example.com`);
  await q(`INSERT INTO institution_memberships (id,institution_id,user_id,status,joined_at) VALUES ($1,$2,$3,'active',$4)`, [newId(), institution.id, staff, now()]);
  await facilitators.grantFacilitatorRole(owner, institution.id, staff);

  await assert.rejects(
    () => facilitators.logFacilitatedSession(staff, cohort.id, 1, "Ran orientation", 5),
    /Acknowledge week 1/,
  );

  await facilitators.acknowledgeWeekReadiness(staff, programme.id, 1);
  const session = await facilitators.logFacilitatedSession(staff, cohort.id, 1, "Ran orientation with the cohort", 5);
  assert.equal(session.weekNumber, 1);
  assert.equal(session.foundersPresent, 5);
});

test("D-022: acknowledging readiness and logging a session both require the cohort_facilitator role, not just institution membership", async () => {
  const { institution, programme, cohort } = await setup("RoleReq");
  const plainMember = await makeUser(`facilitator_plainmember_${Date.now()}@example.com`);
  await q(`INSERT INTO institution_memberships (id,institution_id,user_id,status,joined_at) VALUES ($1,$2,$3,'active',$4)`, [newId(), institution.id, plainMember, now()]);

  await assert.rejects(() => facilitators.acknowledgeWeekReadiness(plainMember, programme.id, 1), /Forbidden/);
  await assert.rejects(() => facilitators.logFacilitatedSession(plainMember, cohort.id, 1, "Trying anyway", 3), /Forbidden/);
});

test("D-022: a facilitator role granted at one institution does not carry over to another institution's programme", async () => {
  const a = await setup("ScopeA");
  const b = await setup("ScopeB");
  const staffA = await makeUser(`facilitator_scopeA_${Date.now()}@example.com`);
  await q(`INSERT INTO institution_memberships (id,institution_id,user_id,status,joined_at) VALUES ($1,$2,$3,'active',$4)`, [newId(), a.institution.id, staffA, now()]);
  await facilitators.grantFacilitatorRole(a.owner, a.institution.id, staffA);

  await assert.rejects(() => facilitators.acknowledgeWeekReadiness(staffA, b.programme.id, 1), /Forbidden/);
  await assert.rejects(() => facilitators.logFacilitatedSession(staffA, b.cohort.id, 1, "Cross-institution attempt", 2), /Forbidden/);
});

test("D-022: computeFacilitatorCoverageForCohort reflects real logged sessions, additive to (not a replacement for) mentor coverage", async () => {
  const { owner, institution, programme, cohort } = await setup("Coverage");
  const staff = await makeUser(`facilitator_coverage_${Date.now()}@example.com`);
  await q(`INSERT INTO institution_memberships (id,institution_id,user_id,status,joined_at) VALUES ($1,$2,$3,'active',$4)`, [newId(), institution.id, staff, now()]);
  await facilitators.grantFacilitatorRole(owner, institution.id, staff);

  const before = await facilitators.computeFacilitatorCoverageForCohort(cohort.id);
  assert.equal(before.weeksTotal, 14);
  assert.equal(before.weeksWithInternalSession, 0);

  await facilitators.acknowledgeWeekReadiness(staff, programme.id, 1);
  await facilitators.logFacilitatedSession(staff, cohort.id, 1, "Week 1 session, run internally", 4);
  await facilitators.acknowledgeWeekReadiness(staff, programme.id, 1); // idempotent
  await facilitators.logFacilitatedSession(staff, cohort.id, 1, "A second session, same week", 3);

  const after = await facilitators.computeFacilitatorCoverageForCohort(cohort.id);
  assert.equal(after.weeksWithInternalSession, 1);
  assert.equal(after.totalSessionsLogged, 2);
});

test("D-022: logging a session with a blank summary is rejected — no empty session records", async () => {
  const { owner, institution, programme, cohort } = await setup("Blank");
  const staff = await makeUser(`facilitator_blank_${Date.now()}@example.com`);
  await q(`INSERT INTO institution_memberships (id,institution_id,user_id,status,joined_at) VALUES ($1,$2,$3,'active',$4)`, [newId(), institution.id, staff, now()]);
  await facilitators.grantFacilitatorRole(owner, institution.id, staff);
  await facilitators.acknowledgeWeekReadiness(staff, programme.id, 2);

  await assert.rejects(
    () => facilitators.logFacilitatedSession(staff, cohort.id, 2, "   ", 3),
    /Describe what the session actually covered/,
  );
});
