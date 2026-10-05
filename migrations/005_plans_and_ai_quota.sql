-- D-011 (docs/DECISION_LOG.md): a real plan/tier data model with
-- enforcement, and AI usage quotas/cost guardrails. Built free (plain
-- Postgres + the app's existing no-key rule-based fallback) — no payment
-- processor, no paid quota/metering vendor.
--
-- IMPORTANT: this migration does NOT add any payment or checkout flow.
-- Z Cubs has no payment processor connected (see docs/productize.html
-- "Money" layer), so a plan here is set by an admin action or a future
-- real checkout webhook — never a "click to upgrade" button that doesn't
-- actually charge anyone. See D-011 in docs/DECISION_LOG.md.

CREATE TABLE IF NOT EXISTS user_plans (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free_explorer',
  -- 'system' (default assignment), 'admin' (manually set), or a future
  -- payment-provider webhook name once one is actually connected. Never
  -- 'self_checkout' — that flow doesn't exist.
  set_by TEXT NOT NULL DEFAULT 'system',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per real AI call attempt (allowed or blocked-by-quota), so usage
-- is auditable and quotas are computed from real counts, never an
-- estimate. `feature` identifies the call site (suggest, idea, mentor_chat,
-- guide_draft) for later cost-attribution if this ever needs a real budget
-- broken down by feature.
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  block_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON ai_usage_events(created_at);
