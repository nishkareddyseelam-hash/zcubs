CREATE TABLE IF NOT EXISTS insight_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('idea_generation', 'financial_model', 'suggestion')),
  source_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_ref_type TEXT,
  source_ref_id UUID,
  submitted_text TEXT NOT NULL,
  anonymized_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_ref_type, source_ref_id)
);
CREATE INDEX IF NOT EXISTS idx_insight_candidates_status ON insight_candidates(status, category);
