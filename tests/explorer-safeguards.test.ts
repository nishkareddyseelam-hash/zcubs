// Explorer-mode (13-17) real-world-risk safeguards (D-012,
// docs/DECISION_LOG.md). Run with: npm test (requires DATABASE_URL — see
// docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as repo from "../src/lib/repo";
import * as consent from "../src/lib/consent";
import * as mentorship from "../src/lib/mentorship";

async function makeUser(email: string, ageBand: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x',$4,$5) ON CONFLICT (email) DO NOTHING`, [id, email, email, ageBand, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

const BASE_EXPERIMENT = {
  name: "Test experiment", hypothesis: "h", method: "m", kpi: "k", threshold: "t",
  result: "", stopRule: "", opportunityId: "",
};

test("D-012: an Explorer account without confirmed guardian consent cannot save an experiment flagged as involving real money", async () => {
  const userId = await makeUser(`safeguard_explorer_a_${Date.now()}@example.com`, "explorer");
  await assert.rejects(
    () => repo.createExperiment(userId, { ...BASE_EXPERIMENT, involvesMoney: true, involvesContract: false, involvesStrangerContact: false }),
    /confirmed guardian/,
  );
});

test("D-012: the same Explorer account CAN save a non-risky experiment (nothing about the platform itself is gated)", async () => {
  const userId = await makeUser(`safeguard_explorer_b_${Date.now()}@example.com`, "explorer");
  const exp = await repo.createExperiment(userId, { ...BASE_EXPERIMENT, involvesMoney: false, involvesContract: false, involvesStrangerContact: false });
  assert.ok(exp.id);
});

test("D-012: once a guardian is confirmed, the same Explorer account CAN save a risky experiment", async () => {
  const userId = await makeUser(`safeguard_explorer_c_${Date.now()}@example.com`, "explorer");
  const { relationship, confirmToken } = await consent.addGuardianRelationship(userId, { guardianName: "G", guardianEmail: `g_${Date.now()}@example.com` });
  await consent.confirmGuardianRelationship(relationship.id, confirmToken);

  const exp = await repo.createExperiment(userId, { ...BASE_EXPERIMENT, involvesMoney: false, involvesContract: true, involvesStrangerContact: false });
  assert.ok(exp.id);
  assert.equal(exp.involvesContract, true);
});

test("D-012: an adult (founder-band) account is never gated by this, regardless of the risk flags", async () => {
  const userId = await makeUser(`safeguard_adult_${Date.now()}@example.com`, "founder");
  const exp = await repo.createExperiment(userId, { ...BASE_EXPERIMENT, involvesMoney: true, involvesContract: true, involvesStrangerContact: true });
  assert.ok(exp.id);
});

test("D-012: an Explorer founder cannot request a mentor without a confirmed guardian, but can once one is confirmed", async () => {
  const founderId = await makeUser(`safeguard_mentor_founder_${Date.now()}@example.com`, "explorer");
  const mentorUserId = await makeUser(`safeguard_mentor_${Date.now()}@example.com`, "founder");
  await mentorship.upsertMentorProfile(mentorUserId, {
    headline: "h", bio: "", expertiseTags: "fundraising", sectors: "", mentorshipMode: "virtual", languages: "English", capacityPerMonth: 5,
    credentialsNote: "Test credentials for automated testing", attestationConfirmed: true,
  });

  await assert.rejects(
    () => mentorship.requestMentorship(founderId, mentorUserId, "Help", ""),
    /confirmed guardian/,
  );

  const { relationship, confirmToken } = await consent.addGuardianRelationship(founderId, { guardianName: "G2", guardianEmail: `g2_${Date.now()}@example.com` });
  await consent.confirmGuardianRelationship(relationship.id, confirmToken);

  const request = await mentorship.requestMentorship(founderId, mentorUserId, "Help", "");
  assert.ok(request.id);
});
