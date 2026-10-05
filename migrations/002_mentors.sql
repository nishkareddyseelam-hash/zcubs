-- Mentor Discovery & Matching (D-008, docs/DECISION_LOG.md).
-- Combines two real reference patterns without copying their branding:
--   Wadhwani Foundation style: a mentor is a structured profile (expertise,
--   sectors, mode) and every conversation is a logged session with a
--   summary and next steps, not an untracked chat.
--   MAARG (Startup India) style: founders discover mentors through a
--   ranked match list (expertise/sector overlap with the founder's own
--   real Self Discovery + Opportunity data) and send a structured match
--   request the mentor accepts or declines, rather than mentors being
--   assigned top-down.

CREATE TABLE IF NOT EXISTS mentor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id),
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  expertise_tags TEXT NOT NULL DEFAULT '',
  sectors TEXT NOT NULL DEFAULT '',
  mentorship_mode TEXT NOT NULL DEFAULT 'virtual' CHECK (mentorship_mode IN ('virtual','in_person','hybrid')),
  languages TEXT NOT NULL DEFAULT 'English',
  capacity_per_month INT NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_institution ON mentor_profiles(institution_id);

CREATE TABLE IF NOT EXISTS mentorship_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  focus_area TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','completed','cancelled')),
  decline_note TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (founder_user_id, mentor_user_id, status)
);
CREATE INDEX IF NOT EXISTS idx_mentorship_requests_founder ON mentorship_requests(founder_user_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_requests_mentor ON mentorship_requests(mentor_user_id);

CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  logged_by_user_id UUID NOT NULL REFERENCES users(id),
  session_date DATE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  next_steps TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentorship_sessions_request ON mentorship_sessions(request_id);
