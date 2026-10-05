// AI usage quotas / cost guardrails (D-011, docs/DECISION_LOG.md). This is
// what makes it safe to ever turn on a real ANTHROPIC_API_KEY: a per-user
// daily ceiling (tighter on the free plan, see plans.ts) AND a hard global
// daily ceiling across every user, so a bug, a bulk-generate loop, or a
// traffic spike can't produce a runaway bill even if every user were on
// the most generous plan. When a call is blocked, it is never surfaced as
// an error — the caller falls back to the existing free, honestly-labelled
// non-AI path exactly the way "no key configured" already does.
import { q, qOne, newId, now } from "./pg";
import { getUserPlan, aiDailyLimitFor } from "./plans";

/** Hard ceiling across ALL users, ALL plans, per day. Configurable via env
 * so a real deployment can tune it without a code change; defaults to a
 * conservative number precisely because no billing alerting exists yet —
 * see docs/productize.html "Money" layer. */
function globalDailyCap(): number {
  const raw = process.env.AI_GLOBAL_DAILY_CALL_CAP;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

export type AiQuotaCheck = {
  allowed: boolean;
  reason: string;
  usedToday: number;
  limit: number;
  globalUsedToday: number;
  globalLimit: number;
};

async function countEventsSince(where: string, params: unknown[]): Promise<number> {
  const row = await qOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ai_usage_events WHERE ${where} AND created_at >= date_trunc('day', now())`,
    params
  );
  return row?.count ?? 0;
}

/** Checks (without recording) whether a real AI call is currently allowed
 * for this user. Counts only `allowed=true` events against the limits —
 * a previously-blocked attempt doesn't itself count against the user, so
 * quota resets cleanly at the next UTC day rather than compounding. */
export async function checkAiQuota(userId: string): Promise<AiQuotaCheck> {
  const plan = await getUserPlan(userId);
  const limit = aiDailyLimitFor(plan.plan);
  const globalLimit = globalDailyCap();

  const [usedToday, globalUsedToday] = await Promise.all([
    countEventsSince("user_id=$1 AND allowed=true", [userId]),
    countEventsSince("allowed=true", []),
  ]);

  if (globalUsedToday >= globalLimit) {
    return { allowed: false, reason: "Platform-wide daily AI usage cap reached — falling back to curated suggestions for everyone until it resets.", usedToday, limit, globalUsedToday, globalLimit };
  }
  if (usedToday >= limit) {
    return { allowed: false, reason: `Daily AI draft limit for the ${plan.plan.replace(/_/g, " ")} plan reached (${limit}/day) — falling back to curated suggestions until it resets.`, usedToday, limit, globalUsedToday, globalLimit };
  }
  return { allowed: true, reason: "", usedToday, limit, globalUsedToday, globalLimit };
}

/** Records one real attempt — call once per actual callClaude invocation,
 * whether it was allowed or blocked, so both the per-user and global
 * counters (and any future cost-attribution by `feature`) stay accurate. */
export async function recordAiUsage(userId: string, feature: string, allowed: boolean, blockReason = ""): Promise<void> {
  await q(
    `INSERT INTO ai_usage_events (id, user_id, feature, allowed, block_reason, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [newId(), userId, feature, allowed, blockReason, now()]
  );
}

export type AiUsageSummary = { plan: string; usedToday: number; limit: number };

/** For display — e.g. a small "AI drafts used today: 3/5 (Free Explorer)"
 * line, so the limit is visible before someone runs into it silently. */
export async function getAiUsageSummary(userId: string): Promise<AiUsageSummary> {
  const plan = await getUserPlan(userId);
  const limit = aiDailyLimitFor(plan.plan);
  const usedToday = await countEventsSince("user_id=$1 AND allowed=true", [userId]);
  return { plan: plan.plan, usedToday, limit };
}
