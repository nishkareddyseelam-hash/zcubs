// Razorpay payment integration (D-020, docs/DECISION_LOG.md). Run with:
// npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
//
// Honest scope note: these tests cover everything that doesn't require a
// live network call to Razorpay's own API (webhook signature
// verification, price-config validation, idempotent plan-crediting
// logic). Actually creating an order against Razorpay's real API was not
// verified in this session — there were no Razorpay test-mode credentials
// available — see D-020 in the decision log for exactly what still needs
// manual verification once real test keys are added.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { q, newId, now } from "../src/lib/pg";
import * as plans from "../src/lib/plans";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

test("D-020: priceInrFor reads RAZORPAY_PRICE_INR_<PLAN> env vars, and returns null for an unset or invalid price", async () => {
  const payments = await import("../src/lib/payments.ts");
  delete process.env.RAZORPAY_PRICE_INR_FOUNDER_BUILDER;
  assert.equal(payments.priceInrFor("founder_builder"), null);

  process.env.RAZORPAY_PRICE_INR_FOUNDER_BUILDER = "999";
  assert.equal(payments.priceInrFor("founder_builder"), 999);

  process.env.RAZORPAY_PRICE_INR_FOUNDER_BUILDER = "not-a-number";
  assert.equal(payments.priceInrFor("founder_builder"), null);

  process.env.RAZORPAY_PRICE_INR_FOUNDER_BUILDER = "-50";
  assert.equal(payments.priceInrFor("founder_builder"), null, "a negative price must never be treated as configured");

  delete process.env.RAZORPAY_PRICE_INR_FOUNDER_BUILDER;
});

test("D-020: getPurchasablePlans only lists plans with a real, valid configured price — never all plans by default", async () => {
  const payments = await import("../src/lib/payments.ts");
  for (const code of plans.PLAN_CODES) delete process.env[`RAZORPAY_PRICE_INR_${code.toUpperCase()}`];
  assert.deepEqual(payments.getPurchasablePlans(), []);

  process.env.RAZORPAY_PRICE_INR_FOUNDER_BUILDER = "999";
  process.env.RAZORPAY_PRICE_INR_INDIA_LAUNCH_PACK = "2499";
  const purchasable = payments.getPurchasablePlans();
  assert.equal(purchasable.length, 2);
  assert.ok(purchasable.find((p) => p.plan === "founder_builder" && p.priceInr === 999));
  assert.ok(purchasable.find((p) => p.plan === "india_launch_pack" && p.priceInr === 2499));
  // institution/enterprise_government were never given a price — confirm they're absent, not silently included.
  assert.ok(!purchasable.find((p) => p.plan === "institution" || p.plan === "enterprise_government"));

  delete process.env.RAZORPAY_PRICE_INR_FOUNDER_BUILDER;
  delete process.env.RAZORPAY_PRICE_INR_INDIA_LAUNCH_PACK;
});

test("D-020: createPlanOrder throws a clear error for a plan with no configured price, before ever calling Razorpay's API", async () => {
  const payments = await import("../src/lib/payments.ts");
  const userId = await makeUser(`payments_noprice_${Date.now()}@example.com`);
  delete process.env.RAZORPAY_PRICE_INR_INSTITUTION;
  await assert.rejects(
    () => payments.createPlanOrder(userId, "institution"),
    /no self-serve price configured/,
  );
});

test("D-020: createPlanOrder rejects an unknown plan code outright", async () => {
  const payments = await import("../src/lib/payments.ts");
  const userId = await makeUser(`payments_unknown_${Date.now()}@example.com`);
  await assert.rejects(
    () => payments.createPlanOrder(userId, "not_a_real_plan"),
    /Unknown plan code/,
  );
});

test("D-020: verifyWebhookSignature accepts a genuinely valid HMAC and rejects a tampered one", async () => {
  const payments = await import("../src/lib/payments.ts");
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_for_ci";
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_test123", order_id: "order_test123" } } } });
  const validSignature = crypto.createHmac("sha256", "test_webhook_secret_for_ci").update(body).digest("hex");

  assert.equal(payments.verifyWebhookSignature(body, validSignature), true);
  assert.equal(payments.verifyWebhookSignature(body, "0".repeat(64)), false, "a wrong-but-well-formed signature must be rejected");
  assert.equal(payments.verifyWebhookSignature(body + "tampered", validSignature), false, "a modified body must invalidate a previously-valid signature");
  assert.equal(payments.verifyWebhookSignature(body, ""), false, "an empty signature must never pass");

  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

test("D-020: handleWebhookEvent ignores event types it doesn't act on, and event payloads with no matching order", async () => {
  const payments = await import("../src/lib/payments.ts");
  const ignored = await payments.handleWebhookEvent({ event: "order.paid", payload: {} });
  assert.equal(ignored.handled, false);

  const noMatch = await payments.handleWebhookEvent({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_x", order_id: "order_that_does_not_exist_in_our_db" } } },
  });
  assert.equal(noMatch.handled, false);
});

test("D-020: handleWebhookEvent upgrades the real plan on payment.captured, is idempotent on a retry, and never double-applies", async () => {
  const payments = await import("../src/lib/payments.ts");
  const userId = await makeUser(`payments_webhook_${Date.now()}@example.com`);
  const orderId = `order_test_${Date.now()}`;

  // Insert a 'created' purchase directly — bypassing createPlanOrder,
  // which would need a real Razorpay API call to actually create the
  // order it's recording (not available in this test environment; see
  // the file-level note above).
  const purchaseId = newId();
  await q(
    `INSERT INTO plan_purchases (id, user_id, plan, amount_paise, currency, razorpay_order_id, status, created_at, updated_at)
     VALUES ($1,$2,'founder_builder',99900,'INR',$3,'created',$4,$4)`,
    [purchaseId, userId, orderId, now()]
  );

  const before = await plans.getUserPlan(userId);
  assert.equal(before.plan, "free_explorer");

  const first = await payments.handleWebhookEvent({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_first", order_id: orderId } } },
  });
  assert.equal(first.handled, true);

  const after = await plans.getUserPlan(userId);
  assert.equal(after.plan, "founder_builder");
  assert.equal(after.setBy, "razorpay_webhook");

  // Simulate Razorpay retrying delivery of the exact same event.
  const retry = await payments.handleWebhookEvent({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_first", order_id: orderId } } },
  });
  assert.match(retry.note, /already marked paid/);

  const stillAfter = await plans.getUserPlan(userId);
  assert.equal(stillAfter.plan, "founder_builder", "a retried webhook must not re-run or double-apply the upgrade");
});

test("D-020: handleWebhookEvent marks a purchase failed on payment.failed, without touching the user's plan", async () => {
  const payments = await import("../src/lib/payments.ts");
  const userId = await makeUser(`payments_failed_${Date.now()}@example.com`);
  const orderId = `order_test_failed_${Date.now()}`;
  await q(
    `INSERT INTO plan_purchases (id, user_id, plan, amount_paise, currency, razorpay_order_id, status, created_at, updated_at)
     VALUES ($1,$2,'founder_builder',99900,'INR',$3,'created',$4,$4)`,
    [newId(), userId, orderId, now()]
  );

  const result = await payments.handleWebhookEvent({
    event: "payment.failed",
    payload: { payment: { entity: { id: "pay_failed", order_id: orderId } } },
  });
  assert.equal(result.handled, true);

  const row = (await q<{ status: string }>(`SELECT status FROM plan_purchases WHERE razorpay_order_id=$1`, [orderId]))[0];
  assert.equal(row.status, "failed");

  const userPlan = await plans.getUserPlan(userId);
  assert.equal(userPlan.plan, "free_explorer", "a failed payment must never upgrade the plan");
});
