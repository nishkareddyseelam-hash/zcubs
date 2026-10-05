// Plan/tier data model (D-011, docs/DECISION_LOG.md). Real enforcement,
// not a display-only pricing page. A plan is set either by an admin
// action, or — for a plan with a configured self-serve price — by
// Razorpay's signature-verified webhook after a real payment (D-020,
// src/lib/payments.ts). Never a self-serve "Upgrade" button that doesn't
// actually take payment, and never a client callback that grants a plan
// on its own say-so.
import { q, qOne, now } from "./pg";

export const PLAN_CODES = [
  "free_explorer",
  "founder_builder",
  "india_launch_pack",
  "mentor_reviewed",
  "institution",
  "enterprise_government",
] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const PLAN_LABELS: Record<PlanCode, string> = {
  free_explorer: "Free Explorer",
  founder_builder: "Founder Builder",
  india_launch_pack: "India Launch Pack",
  mentor_reviewed: "Mentor Reviewed",
  institution: "Institution",
  enterprise_government: "Enterprise / Government",
};

/** Daily AI-assisted-draft allowance per plan. These are starting, clearly
 * adjustable defaults (see D-011), not researched figures — the point is
 * that a real ceiling exists per plan, tightest on the free tier, so cost
 * scales roughly with what a user has actually committed to rather than
 * being unlimited-until-the-bill-arrives for everyone. */
export const PLAN_AI_DAILY_LIMITS: Record<PlanCode, number> = {
  free_explorer: 5,
  founder_builder: 20,
  india_launch_pack: 30,
  mentor_reviewed: 30,
  institution: 60,
  enterprise_government: 150,
};

export type UserPlan = { userId: string; plan: PlanCode; setBy: string; note: string; createdAt: string; updatedAt: string };

const PLAN_COLS = `
  user_id AS "userId", plan, set_by AS "setBy", note,
  created_at::text AS "createdAt", updated_at::text AS "updatedAt"
`;

function isPlanCode(v: string): v is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(v);
}

/** Every user is on Free Explorer until something explicitly sets
 * otherwise — created lazily on first read rather than at signup, so the
 * migration never needs a backfill pass over existing accounts. */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const existing = await qOne<UserPlan>(`SELECT ${PLAN_COLS} FROM user_plans WHERE user_id=$1`, [userId]);
  if (existing) return existing;
  await q(
    `INSERT INTO user_plans (user_id, plan, set_by, note, created_at, updated_at)
     VALUES ($1,'free_explorer','system','Default plan — no explicit plan set yet',$2,$2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, now()]
  );
  const row = await qOne<UserPlan>(`SELECT ${PLAN_COLS} FROM user_plans WHERE user_id=$1`, [userId]);
  return row as UserPlan;
}

/** Sets a user's plan. `setBy` records how — 'admin' for a manual change
 * today; a real payment-provider webhook name once one exists. Never call
 * this from a public, unauthenticated, or unpaid-checkout code path. */
export async function setUserPlan(userId: string, plan: string, setBy: string, note = ""): Promise<UserPlan> {
  if (!isPlanCode(plan)) throw new Error(`Unknown plan code: ${plan}`);
  await q(
    `INSERT INTO user_plans (user_id, plan, set_by, note, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5)
     ON CONFLICT (user_id) DO UPDATE SET plan=$2, set_by=$3, note=$4, updated_at=$5`,
    [userId, plan, setBy, note, now()]
  );
  const row = await qOne<UserPlan>(`SELECT ${PLAN_COLS} FROM user_plans WHERE user_id=$1`, [userId]);
  return row as UserPlan;
}

export function aiDailyLimitFor(plan: PlanCode): number {
  return PLAN_AI_DAILY_LIMITS[plan] ?? PLAN_AI_DAILY_LIMITS.free_explorer;
}
