-- Razorpay payment records (D-020, docs/DECISION_LOG.md). One row per
-- checkout attempt for a plan upgrade. `status` starts 'created' the
-- moment an order is created (before the user has paid anything), moves
-- to 'paid' only once Razorpay's webhook confirms a captured payment
-- (never on the client-side redirect alone — see D-020), or 'failed' if
-- Razorpay reports a failure.
CREATE TABLE IF NOT EXISTS plan_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_purchases_user ON plan_purchases(user_id);
