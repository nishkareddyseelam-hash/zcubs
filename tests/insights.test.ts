// Insight library (D-021, docs/DECISION_LOG.md). Run with:
// npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as consent from "../src/lib/consent";
import * as insights from "../src/lib/insights";
import { grantRole } from "../src/lib/institutional";

async function makeUser(email: string, ageBand = "founder") {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x',$4,$5) ON CONFLICT (email) DO NOTHING`, [id, email, email, ageBand, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

async function makeAdmin(email: string) {
  const id = await makeUser(email);
  await grantRole(id, "platform", "platform", "platform_super_administrator", id);
  return id;
}

test("D-021: submitInsightCandidate rejects empty text and unknown categories", async () => {
  const userId = await makeUser(`insight_empty_${Date.now()}@example.com`);
  await assert.rejects(
    () => insights.submitInsightCandidate(userId, "idea_generation", "   "),
    /Nothing to share/,
  );
  await assert.rejects(
    // @ts-expect-error deliberately invalid category for the test
    () => insights.submitInsightCandidate(userId, "not_a_real_category", "some text"),
    /Unknown insight category/,
  );
});

test("D-021: a founder account can submit a candidate, which is recorded as pending and logs real consent", async () => {
  const userId = await makeUser(`insight_submit_${Date.now()}@example.com`);
  const candidate = await insights.submitInsightCandidate(userId, "idea_generation", "Title: Campus laundry pickup\nCustomer: hostel students");
  assert.equal(candidate.status, "pending");
  assert.equal(candidate.anonymizedText, null);

  const consentStatus = await consent.getConsentStatus(userId);
  assert.equal(consentStatus["ai_insight_sharing"]?.granted, true);
});

test("D-021: submitting the same ref twice is rejected — no duplicate candidates for one card", async () => {
  const userId = await makeUser(`insight_dup_${Date.now()}@example.com`);
  const ref = { type: "opportunity", id: newId() };
  await insights.submitInsightCandidate(userId, "idea_generation", "First submission text", ref);
  await assert.rejects(
    () => insights.submitInsightCandidate(userId, "idea_generation", "Second attempt, same card", ref),
    /already shared/,
  );
});

test("D-021: an Explorer (13-17) account without a confirmed guardian cannot share, but can once a guardian is confirmed", async () => {
  const userId = await makeUser(`insight_explorer_${Date.now()}@example.com`, "explorer");
  await assert.rejects(
    () => insights.submitInsightCandidate(userId, "idea_generation", "An explorer's idea"),
    /Explorer accounts need a confirmed guardian/,
  );

  const { relationship, confirmToken } = await consent.addGuardianRelationship(userId, { guardianName: "G", guardianEmail: `g_${Date.now()}@example.com` });
  await consent.confirmGuardianRelationship(relationship.id, confirmToken);

  const candidate = await insights.submitInsightCandidate(userId, "idea_generation", "An explorer's idea, now consented");
  assert.equal(candidate.status, "pending");
});

test("D-021: listPendingInsightCandidates, approveInsightCandidate and rejectInsightCandidate all require the platform_super_administrator role", async () => {
  const nonAdmin = await makeUser(`insight_nonadmin_${Date.now()}@example.com`);
  await assert.rejects(() => insights.listPendingInsightCandidates(nonAdmin), /Forbidden/);
  await assert.rejects(() => insights.approveInsightCandidate(nonAdmin, newId(), "anything"), /Forbidden/);
  await assert.rejects(() => insights.rejectInsightCandidate(nonAdmin, newId()), /Forbidden/);
});

test("D-021: an approved candidate needs real anonymized text, and only becomes a real example after approval", async () => {
  const userId = await makeUser(`insight_approve_founder_${Date.now()}@example.com`);
  const admin = await makeAdmin(`insight_approve_admin_${Date.now()}@example.com`);
  const category = "financial_model" as const;

  // A high limit here, not the production default of 2: this dev database
  // is shared and persistent across every test run in this session's
  // history, so a low cap (e.g. 5) can itself already be full of
  // previously-approved financial_model examples from earlier runs —
  // making `before.length + 1` below unreachable regardless of whether
  // approval actually works. A high limit keeps the assertion meaningful.
  const before = await insights.getActiveInsightExamples(category, 10000);

  const candidate = await insights.submitInsightCandidate(userId, category, "Raw text with a real name in it: Priya's laundry business, priya@example.com");

  await assert.rejects(
    () => insights.approveInsightCandidate(admin, candidate.id, "   "),
    /can't be blank/,
  );

  const approved = await insights.approveInsightCandidate(admin, candidate.id, "A campus laundry-pickup business targeting hostel students.");
  assert.equal(approved.status, "approved");
  assert.equal(approved.anonymizedText, "A campus laundry-pickup business targeting hostel students.");

  const after = await insights.getActiveInsightExamples(category, 10000);
  assert.equal(after.length, before.length + 1);
  assert.ok(after.includes("A campus laundry-pickup business targeting hostel students."));
  // The raw, un-anonymized original must never be what's actually used.
  assert.ok(!after.some((e) => e.includes("priya@example.com")));
});

test("D-021: a rejected candidate never becomes an active example, and approving twice fails the second time", async () => {
  const userId = await makeUser(`insight_reject_founder_${Date.now()}@example.com`);
  const admin = await makeAdmin(`insight_reject_admin_${Date.now()}@example.com`);

  const candidate = await insights.submitInsightCandidate(userId, "suggestion", "Some raw suggestion text");
  const rejected = await insights.rejectInsightCandidate(admin, candidate.id, "Not usable.");
  assert.equal(rejected.status, "rejected");

  const examples = await insights.getActiveInsightExamples("suggestion", 20);
  assert.ok(!examples.includes("Some raw suggestion text"));

  // Already reviewed (rejected) — approving it now should not silently succeed.
  await assert.rejects(
    () => insights.approveInsightCandidate(admin, candidate.id, "Trying to approve after rejection"),
    /wasn't pending/,
  );
});
