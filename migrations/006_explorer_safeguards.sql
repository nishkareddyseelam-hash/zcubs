-- D-012 (docs/DECISION_LOG.md): real server-side enforcement of the
-- Explorer-mode (13-17) safety guidance that already existed as text in
-- the seeded 14-week journey (youthSafetyNote in src/lib/institutional.ts)
-- but was never actually checked anywhere. Structured, self-declared risk
-- flags on an experiment — not a keyword scan of free text, which would
-- be an unreliable guess dressed up as detection — gated on the D-010
-- guardian-consent record.
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS involves_money BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS involves_contract BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS involves_stranger_contact BOOLEAN NOT NULL DEFAULT false;
