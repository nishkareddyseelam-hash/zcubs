// Plan/tier model + AI usage quotas (D-011, docs/DECISION_LOG.md). Run
// with: npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as plans from "../src/lib/plans";
import * as aiQuota from "../src/lib/aiQuota";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

test("D-011: a user with no plan record defaults to free_explorer, created lazily on first read", async () => {
  const userId = await makeUser(`plan_default_${Date.now()}@example.com`);
  const plan = await plans.getUserPlan(userId);
  assert.equal(plan.plan, "free_explorer");
  assert.equal(plan.setBy, "system");

  // Second read must return the same row, not create a duplicate/error.
  const again = await plans.getUserPlan(userId);
  assert.equal(again.plan, "free_explorer");
});

test("D-011: setUserPlan changes the plan and is rejected for an unknown plan code", async () => {
  const userId = await makeUser(`plan_set_${Date.now()}@example.com`);
  await plans.setUserPlan(userId, "founder_builder", "admin", "manually upgraded for testing");
  const plan = await plans.getUserPlan(userId);
  assert.equal(plan.plan, "founder_builder");
  assert.equal(plan.setBy, "admin");

  await assert.rejects(() => plans.setUserPlan(userId, "diamond_tier", "admin"), /Unknown plan code/);
});

test("D-011: AI quota blocks a user once their plan's daily limit of ALLOWED calls is reached, and blocked attempts don't themselves count against the limit", async () => {
  const userId = await makeUser(`quota_user_${Date.now()}@example.com`);
  await plans.setUserPlan(userId, "free_explorer", "admin");
  const limit = plans.PLAN_AI_DAILY_LIMITS.free_explorer;

  for (let i = 0; i < limit; i++) {
    const check = await aiQuota.checkAiQuota(userId);
    assert.equal(check.allowed, true, `call ${i + 1} of ${limit} should be allowed`);
    await aiQuota.recordAiUsage(userId, "test_feature", true);
  }

  const blocked = await aiQuota.checkAiQuota(userId);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /free explorer/i);
  await aiQuota.recordAiUsage(userId, "test_feature", false, blocked.reason);

  // Recording the blocked attempt must not further tighten the limit —
  // usedToday should still read exactly `limit`, not limit+1.
  const summary = await aiQuota.getAiUsageSummary(userId);
  assert.equal(summary.usedToday, limit);
});

test("D-011: a paid plan gets a higher daily AI limit than the free plan", async () => {
  const freeUser = await makeUser(`quota_free_${Date.now()}@example.com`);
  const paidUser = await makeUser(`quota_paid_${Date.now()}@example.com`);
  await plans.setUserPlan(paidUser, "institution", "admin");

  const freeCheck = await aiQuota.checkAiQuota(freeUser);
  const paidCheck = await aiQuota.checkAiQuota(paidUser);
  assert.ok(paidCheck.limit > freeCheck.limit, "institution plan must have a higher daily limit than free_explorer");
});

test("D-011: the platform-wide daily cap blocks calls even for a user nowhere near their own plan limit", async () => {
  const original = process.env.AI_GLOBAL_DAILY_CALL_CAP;
  process.env.AI_GLOBAL_DAILY_CALL_CAP = "2";
  try {
    const spender = await makeUser(`quota_global_spender_${Date.now()}@example.com`);
    await plans.setUserPlan(spender, "enterprise_government", "admin"); // high per-user limit, irrelevant here
    await aiQuota.recordAiUsage(spender, "test_feature", true);
    await aiQuota.recordAiUsage(spender, "test_feature", true);

    const freshUser = await makeUser(`quota_global_fresh_${Date.now()}@example.com`);
    const check = await aiQuota.checkAiQuota(freshUser);
    assert.equal(check.allowed, false, "a brand-new user with zero usage of their own must still be blocked once the global cap is spent");
    assert.match(check.reason, /platform-wide/i);
  } finally {
    if (original === undefined) delete process.env.AI_GLOBAL_DAILY_CALL_CAP;
    else process.env.AI_GLOBAL_DAILY_CALL_CAP = original;
  }
});
