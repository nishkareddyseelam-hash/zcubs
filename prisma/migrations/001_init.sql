-- Z Cubs — Institutional Edition schema.
-- Executable counterpart of prisma/schema.prisma (see D-007 in
-- docs/DECISION_LOG.md for why this is hand-written SQL rather than
-- Prisma-managed migrations). Applied by scripts/migrate.ts, which tracks
-- applied files in the `_migrations` table so this is safe to re-run.

CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  age_band TEXT NOT NULL DEFAULT 'founder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------------------------------------------------------------------
-- Tenancy hierarchy
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS government_organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'state_department',
  state TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT NOT NULL DEFAULT '',
  institution_type TEXT NOT NULL DEFAULT 'university',
  identifier TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  age_groups_served TEXT NOT NULL DEFAULT '',
  preferred_language TEXT NOT NULL DEFAULT 'en',
  time_zone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','verification_pending','active','suspended','archived')),
  government_org_id UUID REFERENCES government_organisations(id),
  branding_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_institutions_gov_org ON institutions(government_org_id);
CREATE INDEX IF NOT EXISTS idx_institutions_status ON institutions(status);

CREATE TABLE IF NOT EXISTS institution_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  evidence_note TEXT NOT NULL DEFAULT '',
  source_doc_ref TEXT NOT NULL DEFAULT '',
  verified_by TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inst_verif_institution ON institution_verifications(institution_id);

CREATE TABLE IF NOT EXISTS institution_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','withdrawn')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_inst_membership_user ON institution_memberships(user_id);

CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','government_org','institution','programme','cohort')),
  scope_id TEXT NOT NULL,
  role TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope_type, scope_id, role)
);
CREATE INDEX IF NOT EXISTS idx_role_user ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_scope ON role_assignments(scope_type, scope_id);

-- ---------------------------------------------------------------------
-- Programme Builder
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  programme_type TEXT NOT NULL DEFAULT 'university_pre_incubation',
  age_group TEXT NOT NULL DEFAULT '18+',
  eligibility_note TEXT NOT NULL DEFAULT '',
  geography TEXT NOT NULL DEFAULT '',
  sector_focus TEXT NOT NULL DEFAULT '',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  application_opens_at TIMESTAMPTZ,
  application_closes_at TIMESTAMPTZ,
  cohort_size_target INT,
  delivery_mode TEXT NOT NULL DEFAULT 'blended',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','applications_open','applications_closed','running','completed','archived')),
  visibility TEXT NOT NULL DEFAULT 'institution_only' CHECK (visibility IN ('public','invite_only','institution_only')),
  data_retention_note TEXT NOT NULL DEFAULT '',
  is_demonstration BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_programmes_institution ON programmes(institution_id);
CREATE INDEX IF NOT EXISTS idx_programmes_status ON programmes(status);

CREATE TABLE IF NOT EXISTS programme_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  title TEXT NOT NULL,
  learning_objective TEXT NOT NULL DEFAULT '',
  activity_summary TEXT NOT NULL DEFAULT '',
  founder_deliverable TEXT NOT NULL DEFAULT '',
  faculty_guidance TEXT NOT NULL DEFAULT '',
  mentor_prompt TEXT NOT NULL DEFAULT '',
  evidence_requirement TEXT NOT NULL DEFAULT '',
  reflection_question TEXT NOT NULL DEFAULT '',
  youth_safety_note TEXT NOT NULL DEFAULT '',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (programme_id, week_number)
);
CREATE INDEX IF NOT EXISTS idx_prog_weeks_programme ON programme_weeks(programme_id);

-- ---------------------------------------------------------------------
-- Cohorts
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'forming' CHECK (status IN ('forming','active','completed','archived')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_demonstration BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cohorts_programme ON cohorts(programme_id);

CREATE TABLE IF NOT EXISTS cohort_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_cohort TEXT NOT NULL DEFAULT 'founder',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','graduated','withdrawn','deferred')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cohort_membership_user ON cohort_memberships(user_id);

CREATE TABLE IF NOT EXISTS venture_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohorts(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venture_teams_cohort ON venture_teams(cohort_id);

-- ---------------------------------------------------------------------
-- Applications & evaluation
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS application_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL UNIQUE REFERENCES programmes(id) ON DELETE CASCADE,
  is_team_allowed BOOLEAN NOT NULL DEFAULT true,
  requires_guardian_consent BOOLEAN NOT NULL DEFAULT false,
  late_policy_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES application_forms(id) ON DELETE CASCADE,
  "order" INT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  required BOOLEAN NOT NULL DEFAULT true,
  options_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_app_questions_form ON application_questions(form_id);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES application_forms(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES users(id),
  answers_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','eligibility_review','eligible','ineligible',
    'under_evaluation','clarification_requested','shortlisted','waitlisted',
    'selected','not_selected','withdrawn','archived'
  )),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_applications_form ON applications(form_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

CREATE TABLE IF NOT EXISTS eligibility_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  eligible BOOLEAN NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluation_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL UNIQUE REFERENCES programmes(id) ON DELETE CASCADE,
  is_blind_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES evaluation_rubrics(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'human_judgement' CHECK (kind IN (
    'objective_eligibility_rule','human_judgement','derived_metric','ai_assisted_observation'
  )),
  "order" INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_eval_criteria_rubric ON evaluation_criteria(rubric_id);

CREATE TABLE IF NOT EXISTS evaluator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  evaluator_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','recused','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, evaluator_user_id)
);
CREATE INDEX IF NOT EXISTS idx_evaluator_assign_evaluator ON evaluator_assignments(evaluator_user_id);

CREATE TABLE IF NOT EXISTS conflict_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluator_assignment_id UUID NOT NULL UNIQUE REFERENCES evaluator_assignments(id) ON DELETE CASCADE,
  has_conflict BOOLEAN NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  evaluator_user_id UUID NOT NULL REFERENCES users(id),
  reasoning TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, evaluator_user_id)
);
CREATE INDEX IF NOT EXISTS idx_evaluations_application ON evaluations(application_id);

CREATE TABLE IF NOT EXISTS evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES evaluation_criteria(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  UNIQUE (evaluation_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS selection_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('selected','not_selected','waitlisted')),
  reasoning TEXT NOT NULL DEFAULT '',
  decided_by UUID NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT '',
  scope_id TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_scope ON audit_events(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);

-- ---------------------------------------------------------------------
-- Founder domain (migrated from src/lib/db.ts's SQLite tables)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS founder_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  strengths TEXT NOT NULL,
  develop TEXT NOT NULL,
  time TEXT NOT NULL,
  capital TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'Medium',
  categories TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venture_team_id UUID REFERENCES venture_teams(id),
  institution_id UUID REFERENCES institutions(id),
  programme_id UUID REFERENCES programmes(id),
  cohort_id UUID REFERENCES cohorts(id),
  title TEXT NOT NULL,
  customer TEXT NOT NULL,
  problem TEXT NOT NULL,
  evidence_class TEXT NOT NULL DEFAULT 'assumption',
  evidence_note TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  capital TEXT NOT NULL DEFAULT 'Medium',
  mission TEXT NOT NULL,
  dim_fit INT NOT NULL DEFAULT 5,
  dim_evidence INT NOT NULL DEFAULT 5,
  dim_customer INT NOT NULL DEFAULT 5,
  dim_defensibility INT NOT NULL DEFAULT 5,
  dim_capital INT NOT NULL DEFAULT 5,
  dim_margin INT NOT NULL DEFAULT 5,
  dim_scale INT NOT NULL DEFAULT 5,
  dim_social INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_institution ON opportunities(institution_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_programme ON opportunities(programme_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_cohort ON opportunities(cohort_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_ventureteam ON opportunities(venture_team_id);

CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  method TEXT NOT NULL,
  kpi TEXT NOT NULL,
  threshold TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '',
  met_threshold TEXT NOT NULL DEFAULT 'unknown',
  stop_rule TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_experiments_user ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_opportunity ON experiments(opportunity_id);

CREATE TABLE IF NOT EXISTS evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL DEFAULT '',
  claim TEXT NOT NULL,
  metric TEXT NOT NULL,
  ev_class TEXT NOT NULL DEFAULT 'assumption',
  publisher TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  geography TEXT NOT NULL DEFAULT '',
  data_period TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  access_date TEXT NOT NULL DEFAULT '',
  supersedes_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_user ON evidence_items(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_opportunity ON evidence_items(opportunity_id);

CREATE TABLE IF NOT EXISTS risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  risk TEXT NOT NULL,
  mitigation TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risks_user ON risks(user_id);

CREATE TABLE IF NOT EXISTS financial_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  cac DOUBLE PRECISION NOT NULL DEFAULT 0,
  churn DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  cogs_pct DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  fixed_monthly DOUBLE PRECISION NOT NULL DEFAULT 0,
  start_units DOUBLE PRECISION NOT NULL DEFAULT 0,
  growth DOUBLE PRECISION NOT NULL DEFAULT 0,
  annual_price_growth_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  annual_cac_inflation_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  annual_fixed_cost_inflation_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax_rate_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  starting_cash DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scenario)
);

CREATE TABLE IF NOT EXISTS mentor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lens TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_user ON mentor_messages(user_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);

CREATE TABLE IF NOT EXISTS app_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_opportunity_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS comparable_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  source_publisher TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  status_note TEXT NOT NULL DEFAULT '',
  last_rechecked TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comparable_user ON comparable_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_comparable_opportunity ON comparable_companies(opportunity_id);

CREATE TABLE IF NOT EXISTS ecosystem_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'investor',
  name TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  application_status TEXT NOT NULL DEFAULT 'not_started',
  deadline TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ecosystem_user ON ecosystem_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_ecosystem_opportunity ON ecosystem_contacts(opportunity_id);

CREATE TABLE IF NOT EXISTS business_plan (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  executive_summary TEXT NOT NULL DEFAULT '',
  market_section TEXT NOT NULL DEFAULT '',
  business_model_section TEXT NOT NULL DEFAULT '',
  go_to_market_section TEXT NOT NULL DEFAULT '',
  ops_section TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actuals_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL,
  revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
  customers DOUBLE PRECISION NOT NULL DEFAULT 0,
  costs DOUBLE PRECISION NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period)
);

CREATE TABLE IF NOT EXISTS dpr_inputs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  land_building DOUBLE PRECISION NOT NULL DEFAULT 0,
  machinery DOUBLE PRECISION NOT NULL DEFAULT 0,
  working_capital_margin DOUBLE PRECISION NOT NULL DEFAULT 0,
  preliminary_expenses DOUBLE PRECISION NOT NULL DEFAULT 0,
  contingency DOUBLE PRECISION NOT NULL DEFAULT 0,
  promoter_contribution DOUBLE PRECISION NOT NULL DEFAULT 0,
  term_loan_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  term_loan_rate_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  term_loan_tenure_years DOUBLE PRECISION NOT NULL DEFAULT 0,
  wc_loan_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  wc_loan_rate_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guide_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  fields_json TEXT NOT NULL DEFAULT '{}',
  items_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_id)
);

CREATE TABLE IF NOT EXISTS guide_meta (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  template_label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  problem TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
