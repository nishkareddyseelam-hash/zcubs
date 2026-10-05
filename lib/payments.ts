// Razorpay payment integration for plan upgrades (D-020,
// docs/DECISION_LOG.md). Follows the same honesty rule as every other
// credential-dependent feature in this codebase (see src/lib/aiClient.ts,
// D-011): with no Razorpay keys configured, RAZORPAY_ENABLED is false and
// every code path here either no-ops or throws a clear "not configured"
// error — never a fake successful checkout.
//
// Security model: the client-side Checkout success callback is NEVER
// trusted to grant a plan upgrade by itself — a browser can lie. The
// Razorpay webhook (server-to-server, HMAC-signed with a secret only
// Razorpay and this server know) is the only thing that actually calls
// setUserPlan(). This mirrors this project's standing architectural rule
// that every real gate is enforced server-side (see D-005's RBAC,
// D-012's guardian-consent gate) — a client redirect is UI feedback, not
// authorization.
import Razorpay from "razorpay";
import { q, qOne, newId, now } from "./pg";
import { PLAN_CODES, PLAN_LABELS, type PlanCode, setUserPlan } from "./plans";

export const RAZORPAY_ENABLED = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

let client: Razorpay | null = null;
function getClient(): Razorpay {
  if (!RAZORPAY_ENABLED) throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET unset).");
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

/**
 * Self-serve prices, in whole rupees, read from env vars named
 * RAZORPAY_PRICE_INR_<PLAN_CODE-UPPERCASED>. Deliberately not hardcoded —
 * pricing is a real business decision for whoever operates this
 * deployment to make, not something to invent here (see D-020). A plan
 * with no price env var set (e.g. "institution"/"enterprise_government",
 * which this project treats as negotiated sales, not self-serve — see
 * D-020) is simply not purchasable through this flow; getPurchasablePlans
 * reflects only what's actually configured, live.
 */
export function priceInrFor(plan: PlanCode): number | null {
  const raw = process.env[`RAZORPAY_PRICE_INR_${plan.toUpperCase()}`];
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function getPurchasablePlans(): { plan: PlanCode; label: string; priceInr: number }[] {
  return PLAN_CODES.map((plan) => ({ plan, label: PLAN_LABELS[plan], priceInr: priceInrFor(plan) }))
    .filter((p): p is { plan: PlanCode; label: string; priceInr: number } => p.priceInr !== null);
}

export type PlanPurchase = {
  id: string; userId: string; plan: string; amountPaise: number; currency: string;
  razorpayOrderId: string; razorpayPaymentId: string | null; status: "created" | "paid" | "failed";
  createdAt: string; updatedAt: string;
};

const PURCHASE_COLS = `id, user_id AS "userId", plan, amount_paise AS "amountPaise", currency,
  razorpay_order_id AS "razorpayOrderId", razorpay_payment_id AS "razorpayPaymentId", status,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Creates a real Razorpay order for a self-serve plan purchase and
 * records it locally as 'created' (unpaid). Throws if the plan has no
 * configured price — never guesses or defaults an amount. */
export async function createPlanOrder(userId: string, plan: string): Promise<{ purchase: PlanPurchase; keyId: string }> {
  if (!(PLAN_CODES as readonly string[]).includes(plan)) throw new Error(`Unknown plan code: ${plan}`);
  const priceInr = priceInrFor(plan as PlanCode);
  if (priceInr === null) {
    throw new Error(`"${PLAN_LABELS[plan as PlanCode]}" has no self-serve price configured — this plan is sold separately (see docs/DEPLOYMENT.md).`);
  }
  const amountPaise = Math.round(priceInr * 100);

  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `zcubs_${plan}_${userId}_${Date.now()}`,
    notes: { userId, plan },
  });

  const id = newId();
  await q(
    `INSERT INTO plan_purchases (id, user_id, plan, amount_paise, currency, razorpay_order_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'INR',$5,'created',$6,$6)`,
    [id, userId, plan, amountPaise, order.id, now()]
  );
  const purchase = (await qOne<PlanPurchase>(`SELECT ${PURCHASE_COLS} FROM plan_purchases WHERE id=$1`, [id]))!;
  return { purchase, keyId: process.env.RAZORPAY_KEY_ID! };
}

export async function listPlanPurchasesForUser(userId: string): Promise<PlanPurchase[]> {
  return q<PlanPurchase>(`SELECT ${PURCHASE_COLS} FROM plan_purchases WHERE user_id=$1 ORDER BY created_at DESC`, [userId]);
}

/** Verifies a Razorpay webhook request's signature. Pure function over
 * the raw request body — callers MUST pass the exact raw bytes/string
 * Razorpay sent, not a re-serialized JSON.parse'd-and-stringified copy,
 * or the HMAC will never match a real signature. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  return Razorpay.validateWebhookSignature(rawBody, signature, secret);
}

type RazorpayWebhookEvent = {
  event: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
};

/**
 * Processes an already-signature-verified webhook event. Idempotent: a
 * webhook can legitimately be delivered more than once (Razorpay retries
 * on a non-2xx response), so re-processing the same payment_id for an
 * order already marked 'paid' is a safe no-op, not a double-credit or an
 * error. This is the ONLY place a plan purchase actually upgrades a
 * user's plan (see the module-level note on why the client callback
 * never does this itself).
 */
export async function handleWebhookEvent(event: RazorpayWebhookEvent): Promise<{ handled: boolean; note: string }> {
  if (event.event !== "payment.captured" && event.event !== "payment.failed") {
    return { handled: false, note: `Ignoring event type "${event.event}" — only payment.captured/payment.failed are acted on.` };
  }
  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id;
  const paymentId = entity?.id;
  if (!orderId) return { handled: false, note: "Webhook payload had no order_id — nothing to match against." };

  const purchase = await qOne<PlanPurchase>(`SELECT ${PURCHASE_COLS} FROM plan_purchases WHERE razorpay_order_id=$1`, [orderId]);
  if (!purchase) return { handled: false, note: `No plan_purchases row for order ${orderId} — ignoring (not one of ours, or already deleted).` };

  if (event.event === "payment.failed") {
    await q(`UPDATE plan_purchases SET status='failed', razorpay_payment_id=$1, updated_at=$2 WHERE id=$3`, [paymentId ?? null, now(), purchase.id]);
    return { handled: true, note: `Marked purchase ${purchase.id} failed.` };
  }

  // payment.captured
  if (purchase.status === "paid") {
    return { handled: true, note: `Purchase ${purchase.id} was already marked paid — idempotent no-op (likely a webhook retry).` };
  }
  await q(`UPDATE plan_purchases SET status='paid', razorpay_payment_id=$1, updated_at=$2 WHERE id=$3`, [paymentId ?? null, now(), purchase.id]);
  await setUserPlan(purchase.userId, purchase.plan, "razorpay_webhook", `Paid via Razorpay order ${orderId}, payment ${paymentId ?? "unknown"}.`);
  return { handled: true, note: `Upgraded user ${purchase.userId} to plan "${purchase.plan}".` };
}
