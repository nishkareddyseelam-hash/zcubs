-- D-010 (docs/DECISION_LOG.md): a real DPDP Act 2023-shaped data layer for
-- consent and guardian relationships, plus data-subject-rights request
-- tracking (access/export, erasure). Built with free, open tooling only
-- (plain Postgres tables + the existing app) — no paid compliance vendor.
-- This is a data model and honest workflow, not a legal opinion: the actual
-- Terms/Privacy Policy text still needs a lawyer's sign-off before this is
-- used with real minors — see the caveat in docs/DECISION_LOG.md D-010.

-- A guardian linked to an "explorer" (13-17) account. Recorded, not
-- verified by any external identity check (no such free/paid check is
-- wired up) — the honest status is "confirmed by the guardian following
-- the emailed link", not "identity-verified".
CREATE TABLE IF NOT EXISTS guardian_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  explorer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guardian_name TEXT NOT NULL,
  guardian_email TEXT NOT NULL,
  guardian_phone TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT 'parent/guardian',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | revoked
  confirm_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_guardian_rel_explorer ON guardian_relationships(explorer_user_id);

-- One row per consent decision. Append-only (never UPDATEd) so the record
-- of "who consented to what, and when" survives even if consent is later
-- withdrawn by writing a new granted=false row — the standard DPDP pattern
-- of a consent trail rather than a single mutable flag.
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- data_processing | guardian_consent | marketing_contact
  granted BOOLEAN NOT NULL,
  granted_by TEXT NOT NULL, -- 'self' | 'guardian'
  granted_by_relationship_id UUID REFERENCES guardian_relationships(id),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_records_user ON consent_records(user_id, consent_type, created_at DESC);

-- Data Principal rights requests (DPDP Act 2023 s.11-13: access/correction,
-- erasure). Deliberately a *request* row an admin/self action completes,
-- not an instantly-auto-executed deletion — mirrors the "prepared for
-- review, never auto-submitted" pattern already used for institutional
-- reporting exports (docs/ROADMAP.md).
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- export | deletion
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_data_requests_user ON data_requests(user_id, created_at DESC);
