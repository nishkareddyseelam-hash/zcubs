-- D-022 (docs/DECISION_LOG.md): faculty-enablement / train-the-trainer track.
-- Wadhwani's real scale mechanism is training an institution's OWN staff to
-- run sessions, rather than routing every founder through a scarce pool of
-- outside 1:1 mentor accounts (mentor_profiles/mentorship_* stay untouched
-- — this is an additional supply of facilitation, not a replacement).
--
-- facilitator_readiness: a staff member acknowledging the real, existing
-- per-week facultyGuidance/mentorPrompt/youthSafetyNote text (already
-- authored in institutional.ts's DEFAULT_14_WEEK_TEMPLATE, seeded by
-- seedDefault14WeekJourney) for one specific week of one specific
-- programme. This IS the "training materials" — no separate training
-- content system was invented; the guidance text institutions already had
-- is made into a real, gated read-and-acknowledge step instead of inert
-- copy nobody was ever shown.
CREATE TABLE IF NOT EXISTS facilitator_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL,
  UNIQUE (programme_id, user_id, week_number)
);
CREATE INDEX IF NOT EXISTS idx_facilitator_readiness_user ON facilitator_readiness(programme_id, user_id);

-- facilitated_sessions: a real log entry that an institution's own trained
-- staff member ran a given week's session for a given cohort themselves —
-- the direct alternative to routing that founder cohort through an
-- external mentor. Deliberately mirrors mentorship_sessions' shape
-- (summary, logged by the person who actually ran it) rather than
-- inventing a different record format.
CREATE TABLE IF NOT EXISTS facilitated_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  facilitator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  founders_present INT NOT NULL DEFAULT 0,
  ran_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_facilitated_sessions_cohort ON facilitated_sessions(cohort_id);
