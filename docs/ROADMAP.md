# Z Cubs Institutional Edition — Roadmap & Status

Status tags used below, per the governing spec: **Implemented**, **Partial**,
**Demonstration only**, **Credential-dependent**, **Planned**, **Deferred**.
See `docs/DECISION_LOG.md` for the reasoning behind scope decisions.

## Implemented this release

- PostgreSQL persistence for the entire app (founder domain migrated from
  SQLite; old local data preserved via `scripts/migrate-sqlite-to-postgres.ts`).
- Tenancy hierarchy: GovernmentOrganisation → Institution → Programme →
  Cohort → VentureTeam, modeled with real foreign keys.
- RBAC (`RoleAssignment` + `requireRole`/`hasRole`/`requireAnyRole` in
  `src/lib/institutional.ts`), enforced server-side on every institutional
  write (not just hidden buttons) — covered by `tests/rbac.test.ts`.
- Institution onboarding (create, status lifecycle draft → active/etc.,
  `InstitutionVerification` history table kept separate from the public
  `status` field — no institution is labelled "verified" or "government
  approved" without a row here).
- Programme Builder: create a programme, auto-seed the seeded, fully-editable
  default 14-week journey (`seedDefault14WeekJourney`), status lifecycle.
- Cohort management: create cohorts, enrol founders, `computeCohortHealth`
  (enrolment, experiments designed/completed, evidence submitted/verified —
  all computed live from real rows, no opaque single score).
- Applications: configurable question form per programme, public-programme
  discovery for founders with no prior institutional membership, save →
  submit → status lifecycle.
- Evaluation: evaluator assignment, evaluator-scoped evaluation submission
  (an evaluator cannot evaluate an application they weren't assigned to —
  tested), immutable `SelectionDecision` (a second decision on the same
  application is rejected — tested), select-and-enrol as one connected
  action.
- Full audit trail (`audit_events`) on every institutional mutation.
- The pre-existing founder-side modules (Founder Fit Map, Venture Template
  Library, Opportunity Cards, Idea Arena, Evidence Lab, Validation Quest
  Lab, Comparable Businesses, Ecosystem tracker, Money Lab, India Ledger
  DPR, Guide) are preserved, now on Postgres, all regression-tested.
- **Mentor Discovery & Matching, deepened** (D-008, D-009): a Wadhwani-style
  structured mentor profile + logged session history + shared next-check-in
  cadence, combined with MAARG-style founder-driven ranked discovery that
  now factors in real available capacity (not just tag overlap), plus a
  YUKTI/IIC-style live institutional coverage aggregate per cohort. Any
  account can open a mentor profile (`/dashboard/mentors`); founders see
  mentors ranked by real overlap with their own Self Discovery categories
  and Opportunity Card missions and by real capacity headroom; a founder
  sends a structured request, the mentor accepts (blocked server-side if
  already at their own stated capacity) or declines, every session after
  that is logged (date, summary, next steps), and either side can set a
  shared next check-in date, flagged when it's overdue. An institution
  sees a live, honest mentor-coverage line per cohort (founders matched,
  sessions logged, overdue check-ins) on `/dashboard/institution`. No
  fabricated match score, no seeded mentor roster, no AI-assigned match,
  no claimed connection to ARIIA or any government ranking — covered by
  `tests/mentorship.test.ts` (5 tests; correcting an earlier version of
  this line, which conflated the file's own count with the whole suite's
  count at the time).
- **Continuous Integration** (D-010): `.github/workflows/ci.yml` runs the
  real test suite, lint, and a production build against an ephemeral
  Postgres service on every push/PR — free on GitHub Actions, no paid CI
  vendor.
- **Privacy & Consent** (D-010): a DPDP Act 2023-shaped data layer —
  guardian relationships for explorer (13-17) accounts confirmed via a
  public token link, an append-only consent-records trail, and real
  data-subject-rights requests (`/dashboard/privacy`, `/api/privacy/export`):
  a live "download my data" export across every table a founder owns rows
  in, and a human-reviewed deletion workflow (filed as pending, executed
  by a separate explicit action, never auto-run). Explicitly not a legal
  opinion and not identity verification — see D-010's caveats — covered by
  `tests/consent.test.ts` (5 tests; full suite now 14 tests total: 4 in
  `rbac.test.ts` + 5 in `mentorship.test.ts` + 5 here).
- **Plan/tier model + AI usage quotas** (D-011): every user has a real
  plan row (`user_plans`, default `free_explorer`), shown honestly on
  `/dashboard/pricing` — self-serve checkout for plans with a configured
  price arrived in D-020, below; a plan with no price stays admin-set,
  never a fake checkout. All four real AI call sites (suggestions, idea drafting,
  mentor chat, Guide field drafting — including the bulk 20-step
  "start from a template" flow) now go through a quota-aware wrapper
  (`callClaudeForUser`) enforcing a per-plan daily limit AND a hard
  platform-wide daily cap; a blocked call returns the same signal as "no
  API key configured", so every caller's existing honest fallback handles
  it for free. No feature beyond the AI draft allowance is gated by plan
  — covered by `tests/plans-and-quota.test.ts` (5 tests; full suite now
  19 tests).
- **Explorer-mode (13-17) real-world-risk safeguards, enforced** (D-012):
  a real, narrow server-side gate — not the advisory-copy-only state this
  file previously described. Saving a Validation Lab experiment flagged
  (self-declared, three honest checkboxes — never inferred from free text)
  as involving real money, a contract, or contacting someone the founder
  doesn't already know, and sending a mentor request, both require a
  confirmed guardian relationship (D-010) for an Explorer account; every
  other feature (Self Discovery, Opportunity Cards, Evidence Lab, Guide,
  and any non-risky experiment) is unaffected. Money Lab was checked and
  correctly excluded — it's a projection calculator, no real money changes
  hands there. Both gated pages show a proactive notice before a founder
  hits the block, not just an error after — covered by
  `tests/explorer-safeguards.test.ts` (5 tests; full suite now 24 tests).
- **Mentor self-attestation** (D-013): opening a mentor profile now
  requires a real, non-empty credentials statement (what qualifies this
  person to mentor) and an explicit attestation checkbox, both shown back
  to founders on every match card labelled "Self-declared, not verified by
  Z Cubs" — real transparency, not implied vetting. An optional
  self-provided reference contact (name/email/relationship) can also be
  added; Z Cubs never contacts it. This is still NOT a background check or
  credentialing process — see below, unchanged — it replaces "requires
  nothing beyond an account" with an honest, disclosed minimum rather than
  a fabricated verified badge — covered by
  `tests/mentor-attestation.test.ts` (6 tests; full suite now 30 tests).
- **Cohort scoping of founder work** (D-014): a new Opportunity Card is now
  automatically stamped with the founder's real, live cohort/programme/
  institution IDs when they have an active cohort membership (never
  fabricated or defaulted — no membership means the fields stay NULL, same
  as before). `/dashboard` and `/dashboard/opportunities` both show the
  founder their real "you're enrolled in X's Y programme, cohort Z"
  context, and each card that carries a `cohort_id` is labelled with the
  real cohort/programme name it was actually stamped with — covered by
  `tests/cohort-scoping.test.ts` (3 tests; full suite now 33 tests).
- **Evaluation rubric & scoring** (D-015): institutions can now build a
  real weighted rubric per programme (add/remove criteria with a label,
  weight, and kind) and evaluators score applications against it — no
  default criteria are seeded, an evaluator's weighted total is `null`
  (never a fabricated `0`) when nothing was scored, and each evaluator's
  score is shown separately, never merged into one opaque number. The
  `scores` parameter `submitEvaluation` already accepted was previously
  silently dropped by every caller; it's now actually persisted — covered
  by `tests/evaluation-rubric.test.ts` (5 tests; full suite now 38 tests).
- **Cohort transfer, deferral & graduation** (D-016): a founder's cohort
  membership can now actually be set to graduated/withdrawn/deferred, and
  transferred to a same-programme cohort (RBAC-checked on both the source
  and target cohort) — the roster on `/dashboard/institution` shows every
  founder's real name/email and status with inline controls. Cross-
  programme transfer is explicitly rejected rather than silently allowed
  (see D-016's caveats). A transferred founder's next Opportunity Card
  auto-scopes to the new cohort via D-014's existing lookup — covered by
  `tests/cohort-lifecycle.test.ts` (5 tests; full suite now 43 tests).
- **Load-test scripts** (D-017): three k6 scripts
  (`scripts/loadtest/{smoke,founder-journey,institution-dashboard}.js`)
  exercise real signup, real NextAuth login, and real page reads under
  concurrent load — no mocked auth, no fixture accounts. Honestly scoped
  to page reads only, not the Server-Action write paths inside those pages
  (see D-017's caveats for why); not yet wired into CI (needs a running
  server, a different job shape than the existing fast unit-test/lint/
  build run — see Planned, below).
- **Backup & free-tier deploy configuration** (D-018): `docs/DEPLOYMENT.md`
  (previously referenced by `.env.example` and test files but never
  written — a real gap, now closed) documents a researched, real free-tier
  deployment path (Neon Postgres + Render web service, with current
  numbers sourced from each provider's own docs, not assumed). `render.yaml`
  is a working Render Blueprint. `scripts/backup/backup.sh` and
  `restore.sh` are a real, tested pg_dump/restore pair (verified end-to-end
  against a real local database, including a full restore into a scratch
  DB); `.github/workflows/backup.yml` runs the backup daily on GitHub
  Actions' free runners, uploading to an S3-compatible bucket (e.g.
  Cloudflare R2's free tier) when credentials are configured.
- **Terms of Service & Privacy Policy — first drafts** (D-019):
  `docs/legal/TERMS_OF_SERVICE.md` and `docs/legal/PRIVACY_POLICY.md`,
  written from the real, built product (every claim traced to a decision
  in this log) rather than a generic template. Both are explicitly
  labelled DRAFT / not legal advice, and each ends with a "What still
  needs a lawyer" list of the specific open questions (liability
  language, jurisdiction-specific compliance, billing terms once a real
  payment flow exists). Not yet linked in the live product or wired into
  the signup flow — see D-019's caveats.
- **Razorpay integration for plan upgrades** (D-020): real payment
  plumbing — order creation, Standard Checkout, a signature-verified
  webhook, and an idempotent plan upgrade — with prices entirely env-var
  driven per plan (`RAZORPAY_PRICE_INR_<PLAN_CODE>`), never invented. The
  client-side checkout callback is never trusted to grant a plan; only
  the verified webhook does, via the existing `setUserPlan` (D-011). The
  Reports feature (`india_launch_pack`) itself is still **Planned**, not
  gated on anything real yet — this decision buys the ability to buy the
  plan, not the plan's eventual report generator — covered by
  `tests/payments.test.ts` (8 tests; full suite now 51 tests). See
  Partial, below, for what wasn't verified against Razorpay's live API.
- **Insight library** (D-021): a founder can opt one specific piece of
  their own work (starting with Opportunity Cards) into a human-reviewed
  queue; only after a platform administrator reads it, strips anything
  identifying, and writes an anonymized version does it get used — as
  real reference material spliced into the AI's prompt for other
  founders' idea drafts, never as training data for the underlying model
  (Anthropic's API doesn't retrain on what it's sent, and this doesn't
  change that). Explorer (13-17) accounts need a confirmed guardian
  relationship first, same as D-012's other real-world data-sharing
  gates — covered by `tests/insights.test.ts` (7 tests; full suite now
  58 tests). See Partial, below, for what's not built yet.
- **Faculty-enablement / train-the-trainer track** (D-022): a new
  institution-scoped `cohort_facilitator` role lets an institution
  designate its own staff — not just outside mentor accounts — to run a
  cohort's weekly sessions. A facilitator acknowledges the programme's
  real, already-seeded per-week `facultyGuidance`/`mentorPrompt`/
  `youthSafetyNote` text before they're allowed to log a session for that
  week (server-enforced, not just a UI hint), and each logged session
  (what it covered, founders present) rolls up into a live "internal
  facilitation" coverage line on `/dashboard/institution`, additive to —
  never replacing — the existing Mentor coverage line. This is the actual
  software behind Wadhwani Foundation's own publicly-documented scale
  mechanism (training an institution's own staff, not routing every
  founder through a scarce outside-mentor pool), not a claim of Wadhwani
  Foundation's scale itself — no institution count, user count, or
  adoption figure is asserted anywhere in this feature. Covered by
  `tests/facilitators.test.ts` (6 tests; full suite now 64 tests).

## Partial

- **Mentor vetting beyond self-attestation**: D-013 added a required,
  disclosed self-attestation (see above) — there is still no
  reference-check, identity verification, or credentialing step performed
  by Z Cubs itself (D-009: neither MAARG's nor Wadhwani's own public
  materials document their vetting process in enough detail to model
  honestly, so a real one isn't faked here either).

- **Mentor pools scoped to a programme/cohort**: a mentor can currently
  mentor any founder platform-wide; there is no institution-scoped mentor
  roster or cohort-assigned mentor yet (real follow-up once the faculty
  workbench, still Planned below, needs it — D-022's `cohort_facilitator`
  role is a separate, institution-internal supply of facilitation and
  does not scope external mentors).
- **Faculty-enablement track content depth** (D-022): the "training
  materials" a facilitator acknowledges are the same per-week guidance
  text institutions already had (D-006's seeded template) — there's no
  authoring UI to customize that guidance per institution, no assessment
  of whether a facilitator actually understood it beyond a single
  acknowledge click, and no cohort-scoped facilitator roster yet (a
  facilitator granted at institution scope can currently facilitate any
  of that institution's cohorts). The faculty facilitator workbench
  (deliverable review queue, at-risk alerts) named below under Planned is
  still not built — D-022 covers running sessions, not reviewing founder
  deliverables.
- **Guardian consent link delivery**: the confirm link (D-010) is not
  emailed automatically — no provider-neutral email/SMS abstraction is
  wired up yet (see Notifications, below) — it's shown to the founder on
  `/dashboard/privacy` to pass along themselves. The consent data model
  and its enforcement gates are otherwise real — see D-012, above.
- **Razorpay order creation against a live/test API** (D-020): the
  webhook, signature verification, and idempotent plan-crediting logic
  are all tested directly; actually calling Razorpay's real
  `orders.create` end-to-end was not verified in this session — there
  were no Razorpay test-mode credentials available. A deployment operator
  adding real keys should run one manual test checkout before enabling
  this for real users (see `docs/DEPLOYMENT.md`).
- **Insight library coverage** (D-021): only Opportunity Cards have a
  share action so far — financial-model scenarios (`MoneyClient`) are
  supported by the schema/category already but have no share button
  wired in yet. There's also no admin console for granting the
  `platform_super_administrator` role needed to review submissions — same
  honest gap D-011 already names for setting a user's plan; it's a direct
  database action today, not a UI flow.

## Demonstration only

- Nothing in this release fabricates data presented as real. The migrated
  test accounts from earlier development sessions are real (self-created)
  accounts, not synthetic demonstration data — a proper labelled
  demonstration dataset (spec section 38: one government org, two
  institutions, three programmes, four cohorts, etc.) is **Planned**, not
  yet seeded.

## Credential-dependent

- AI-assisted suggestions and mentor replies (`src/lib/aiClient.ts`) —
  already provider-neutral, already fails soft to a deterministic
  rule-based fallback with no key configured (pre-existing, unchanged this
  release).
- IIC/YUKTI/state-portal integrations — no official API is available to
  this build; nothing is scraped or simulated. See "Never simulated" below.

## Planned (not built this release — real, scoped follow-ups)

- Government/Enterprise organisation dashboards (aggregate-only, per spec
  section 26) — the `GovernmentOrganisation` model exists; no dashboard UI.
- Faculty facilitator workbench (deliverable review queue, at-risk alerts).
- Innovation repository + Institutional Reporting Mapping (configurable
  field mapping to IIC/YUKTI-style schemas, versioned, human-reviewed CSV
  export — "prepared for institutional review", never auto-submitted).
- Activity/attendance/event administration (calendar, QR attendance).
- Notifications and announcements (in-app + provider-neutral email/SMS
  abstraction).
- Explorer-mode safeguards specific to the *institutional* layer
  (D-012 enforces the founder-side money/contract/stranger-contact and
  mentor-request gates platform-wide; an institution-scoped version —
  e.g. a faculty approval step for a flagged experiment, per the seeded
  journey's Week 10 `youthSafetyNote` — is not built).
- Full accessibility audit (WCAG 2.2 AA) of the new institutional screens.
- Localisation architecture (English-only currently; no i18n scaffolding
  added this release for the new screens).
- The remainder of the automated test matrix in spec section 39 beyond the
  RBAC/tenancy/immutability tests in `tests/rbac.test.ts`.

## Deferred (explicitly out of scope per the governing spec, unchanged)

Business Blueprint generator, DPR/pitch-deck/professional document
generation (PDF/DOCX/PPTX exports of venture documents), full business-plan
export, website/application builder, investor marketplace, investment
transaction processing, loan processing, grant disbursement, public
crowdfunding, accounting integrations, full operating-business ERP.

When the Blueprint/DPR/pitch-deck export generator above is eventually
built, D-011's plan model (`getUserPlan`/`PLAN_CODES` in `src/lib/plans.ts`)
is the intended gate for it — a paid-plan-only feature, not part of the
free tier — rather than something to build free by default.

## Never simulated, by design

- No institution is labelled "government approved"/"IIC compliant"/"AICTE
  approved" without a verified `InstitutionVerification` record.
- No government portal integration exists or is faked — see
  `docs/DECISION_LOG.md` D-002-adjacent notes; when built, this will be a
  configurable field-mapping + human-reviewed export, never an automated
  submission.
- No AI system makes a selection decision — `recordSelectionDecision` is
  only ever called from a human-initiated Server Action.
- No fixed/fabricated readiness or cohort-health number — every dashboard
  figure in this release is computed live from real rows, consistent with
  the pre-existing founder-side evidence-governance rule.
