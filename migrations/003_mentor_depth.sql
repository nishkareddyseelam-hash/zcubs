-- Deepens Mentor Discovery & Matching (D-009, docs/DECISION_LOG.md) by
-- combining specific, real mechanics from all three researched platforms
-- rather than just their surface shape:
--   MAARG's "AI/ML-powered matchmaking" (real mechanic: available capacity
--   factors into ranking, not just a static tag match) and its built-in
--   meeting scheduler (real mechanic: a shared next-check-in date).
--   Wadhwani's dedicated Growth Advisor with a structured check-in cadence
--   (real mechanic: a named next-check-in, flagged when it's overdue).
--   YUKTI/IIC's institutional reporting layer (real mechanic: an
--   institution can see aggregate, live-computed mentorship coverage for
--   its own cohorts — never a fabricated score).

ALTER TABLE mentorship_requests ADD COLUMN IF NOT EXISTS next_checkin_at DATE;
