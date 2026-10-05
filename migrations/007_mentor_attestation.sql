-- D-013 (docs/DECISION_LOG.md): closes the "opening a mentor profile
-- requires nothing beyond an account" gap flagged since D-009/D-012's
-- ROADMAP entries, WITHOUT faking a background-check or credentialing
-- process neither Wadhwani's nor MAARG's own public materials document
-- in enough detail to model honestly. Self-attestation, shown to founders
-- as exactly that — self-declared, not verified by Z Cubs — plus an
-- optional reference contact a founder or institution can choose to
-- follow up with themselves.
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS credentials_note TEXT NOT NULL DEFAULT '';
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS attestation_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS attested_at TIMESTAMPTZ;
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS reference_name TEXT NOT NULL DEFAULT '';
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS reference_email TEXT NOT NULL DEFAULT '';
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS reference_relationship TEXT NOT NULL DEFAULT '';
