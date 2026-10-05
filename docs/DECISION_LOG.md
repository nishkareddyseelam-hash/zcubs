# Z Cubs — Institutional Edition: Decision Log

This log records architectural decisions made while transforming the Z Cubs
founder-side prototype into a multi-tenant institutional platform. Entries
are append-only; superseded decisions are marked, not deleted.

Status legend used throughout this and other docs: **Implemented**,
**Partial**, **Demonstration only**, **Credential-dependent**, **Planned**,
**Deferred**.

---

## D-001 — Repository audit findings (baseline)

Before this build, `zcubs-app` was:

- Next.js 14 (App Router) + TypeScript + NextAuth (credentials provider,
  bcrypt password hashing) + Tailwind.
- **Persistence: Node's built-in `node:sqlite`**, one file
  (`data/zcubs.db`), no ORM. All access goes through `src/lib/db.ts` (schema
  + migrations via `ALTER TABLE ... ADD COLUMN` try/catch blocks) and
  `src/lib/repo.ts` (954 lines of hand-written SQL query functions).
- **No multi-tenancy.** There is a minimal `institutions` /
  `institution_members` table pair (name, invite code, per-user role string)
  used only cosmetically by `/dashboard/institution` — it is not enforced
  anywhere else. Every other table is scoped only by `userId`. There is no
  Programme, Cohort, Application, Evaluation, Mentor, or Innovation-Record
  concept in the schema at all.
- **No RBAC.** `ageBand` on `users` distinguishes an "Explorer" (13–17) style
  flag from an adult founder, but there are no roles beyond that, and no
  server-side authorization checks beyond `getServerSession` confirming
  *a* user is logged in and owns the row by `userId`.
- Founder-side domain is real and reasonably deep: Founder Fit Map,
  Opportunity Cards, Idea Arena, Evidence Lab (with classification,
  verification status, geography/dataPeriod/license/accessDate provenance,
  and a `supersedesId` correction chain), Validation experiments (with
  `metThreshold` and `stopRule`), a Money Lab with a shared
  `financialModel.ts`/`moneyProjection()` formula module (fixed for
  formula-divergence in a prior session), Comparable Businesses, an
  Ecosystem/Investor tracker, a DPR (India Ledger) module, and a Guide
  (business-plan-adjacent) drafting flow. This is real, working,
  evidence-governed functionality — **it is preserved, not replaced.**
- AI calls (`src/lib/aiClient.ts`) already go through one adapter function
  with a deterministic non-AI fallback path when no provider key is
  configured — this pattern is extended, not rebuilt.
- No test suite exists yet (`npm test` is not defined). No CI config exists.
- No Prisma, no Postgres, no migrations directory.

**Conclusion:** the founder-side vertical is a legitimate foundation to
build on. The institutional layer this request specifies (tenancy,
programmes, cohorts, applications, evaluation, mentors, innovation
repository, reporting) does not exist yet in any form and must be built
from zero, not "deepened."

## D-002 — Move persistence from `node:sqlite` to PostgreSQL + Prisma

**Decision:** migrate to PostgreSQL 16 (already available in this
environment) with Prisma as the ORM/migration tool, per user direction.

**Why:** the spec requires tenant-isolation enforced in the query layer
(not just app code), foreign-key-constrained hierarchy
(Org → Institution → Programme → Cohort → Venture Team → Founder), audit
trails, soft-deletion/archival, composite indexes on
(tenant, programme, cohort, venture, status, date), and transactional
multi-step writes (e.g. evaluation consolidation, selection decisions).
`node:sqlite` with hand-rolled `ALTER TABLE` migrations cannot safely carry
that weight — there's no real foreign-key enforcement in the app's usage
pattern today, no migration history, and no transaction API exposed through
the current `db.ts` wrapper.

**Consequence:** every existing table in `db.ts` is re-modeled as a Prisma
model. Existing SQLite data is migrated forward via a one-time export/import
script (`scripts/migrate-sqlite-to-postgres.ts`) rather than discarded — see
D-003. `src/lib/repo.ts` is rewritten function-by-function to call Prisma
instead of raw SQL, preserving its existing exported function signatures
wherever possible so calling components don't all need to change at once.

## D-003 — Preserve existing local data during the migration

**Decision:** write a one-shot migration script that reads every row out of
`data/zcubs.db` (if present) and inserts it into Postgres under the new
schema, mapping the single implicit "tenant" (all existing rows) into a
generated **Demonstration Institution** so no founder work created during
this session's earlier tasks is silently discarded.

## D-004 — Tenancy hierarchy modeled as explicit parent-linked tables, not a single polymorphic "Org" table

**Decision:** `PlatformOrganisation` (singleton), `GovernmentOrganisation`,
`Institution` (optional `governmentOrgId`), `Programme` (`institutionId`),
`Cohort` (`programmeId`), `VentureTeam` (`cohortId`, optional — a venture
need not belong to a cohort), `Venture` (`founderProfileId`, optional
`ventureTeamId`, optional `programmeId`). Every tenant-scoped table carries
a direct, non-nullable foreign key to the narrowest tenancy level it
belongs to (not just a generic `tenantId`), so Prisma relation filters and
DB foreign-key constraints do the isolation work, and a query that forgets
a `where` clause fails loudly (missing required relation) rather than
silently leaking cross-tenant rows.

## D-005 — RBAC via a single `RoleAssignment` join table, not per-domain role columns

**Decision:** one `RoleAssignment(userId, scopeType, scopeId, role)` table
covers platform/government/institution/programme/cohort-scoped roles
uniformly, rather than a `role` column on each membership table. A
`requireRole()` server-side helper resolves "does this user hold role X at
or above scope Y" by walking the scope chain (cohort → programme →
institution → government org → platform), so an Institution Administrator
role automatically covers programmes/cohorts under that institution without
needing a separate row per programme. Mentor-founder and
evaluator-application relationships are modeled as their own explicit
join tables (`MentorshipMatch`, `EvaluatorAssignment`) rather than
RoleAssignment rows, because those grants are relationship-scoped
(one founder / one application) and time-bounded, not scope-wide.

## D-006 — This release's actual build scope vs. the full 43-section spec

**Decision (stated explicitly, not silently):** the full spec is a
multi-month build. This release delivers, fully working and tested:

1. Postgres + Prisma foundation, with existing founder data preserved.
2. Tenancy hierarchy + RBAC data model and server-side enforcement
   (D-004/D-005), with automated cross-tenant-access-denial tests.
3. Institution onboarding (create/verify workflow, status lifecycle).
4. Programme Builder (create/edit/list programmes, template starting
   points, 14-week journey structure).
5. Cohort management (create cohort, enroll founders, assign faculty).
6. One complete end-to-end vertical: an institution creates a programme →
   a founder applies → an evaluator scores the application → the programme
   manager selects/enrolls them into a cohort → the founder's existing
   Fit Map / Opportunity / Idea Arena / Evidence / Validation / Money Lab
   work is now scoped to that programme + cohort + venture, correctly
   isolated from other tenants.

Everything else in the 43-section spec (mentor session management beyond
the matching skeleton, full evaluation rubric UI, innovation repository,
IIC/YUKTI reporting mapping, government dashboards, notifications,
guardian/consent workflows beyond the data model, AI grounding metadata,
full accessibility audit, full test matrix) is **Planned**, and is recorded
as such in `docs/ROADMAP.md`, not simulated or faked in the UI. No dead
buttons are added for Planned features unless explicitly labeled
"Planned" per the user's own instruction.

## D-008 — Mentor Discovery & Matching (Wadhwani + MAARG combined)

**Ask:** "Build Mentor discovery & matching like the Wadhwani and Maarg
combined" — genuinely new scope; `docs/ROADMAP.md` had this listed as
Planned with no tables built.

**Decision:** combine two real, cited reference patterns without copying
either platform's branding or content:

- **Wadhwani Foundation style** — a mentor relationship is structured and
  logged, not an untracked chat: a mentor opens a real profile (headline,
  expertise, sectors, mode, capacity), and every conversation after a
  match is a `mentorship_sessions` row with a date, summary, and next
  steps.
- **MAARG (Startup India) style** — founders discover mentors through a
  ranked list, not a top-down assignment: `matchMentorsForFounder()`
  scores each active mentor by real overlap between the founder's own
  Self Discovery `categories` + recent Opportunity Card `mission` text
  and the mentor's `expertise_tags`/`sectors`. Zero overlap never hides a
  mentor — it just sorts them lower, alphabetically stable.

**Schema (`prisma/migrations/002_mentors.sql`):** `mentor_profiles`
(one per user, `status` active/paused so a mentor can step back without
deleting history), `mentorship_requests` (founder-initiated,
mentor accepts/declines/completes, with a `decline_note`), and
`mentorship_sessions` (append-only log tied to a request, either
participant can add an entry).

**What is NOT simulated:** no mentor profile exists unless a real account
holder opened one — there is no seeded/fake mentor roster. The match
score is computed only from the founder's own stored text, never a
fabricated "compatibility %". No AI assigns or ranks a match — the
overlap computation is a deterministic string comparison, and the
sort order is disclosed in the UI (mentors with real overlap first,
everyone else after).

**A real bug found and fixed during Playwright verification:** `pg`'s
default type mapping returns Postgres `DATE` columns as JS `Date`
objects, and `session_date` was passed straight into JSX as
`{s.sessionDate}` — React does not render `Date` objects and threw a
client-side hydration crash (React error #31) the moment a session was
logged, even though the row was saved correctly server-side. Fixed by
casting `session_date::text` in every mentorship-session query in
`src/lib/mentorship.ts`, so the type contract (`sessionDate: string`)
matches what actually comes back. Regression-covered in
`tests/mentorship.test.ts` (asserts `typeof s.sessionDate === "string"`).

**Deferred (real, scoped follow-ups, not built this pass):** in-app
notifications when a request/response/session happens (a founder or
mentor currently has to revisit `/dashboard/mentors` to see updates —
no email/SMS abstraction wired to this feature yet), a mentor-side
capacity check that actually blocks new requests once
`capacity_per_month` is reached (the field is stored and shown, not yet
enforced), and cohort/programme-scoped mentor pools (a mentor can
currently mentor any founder platform-wide; institution-scoped mentor
rosters are a real follow-up once faculty workbench (still Planned)
needs it).

## D-009 — Deepening Mentor Discovery & Matching with Wadhwani + MAARG + YUKTI mechanics

**Ask:** "build combined intelligence and depth of mentorship, of these
three platforms, into full stack and update html accordingly" — following
the deepened comparison research (compare.html), turn the specific
mechanics found in each platform's own materials into real, working
features, not just documentation updates.

**What was added, and which real mechanic it comes from:**

1. **Capacity-aware ranking + enforcement** (`matchMentorsForFounder`,
   `respondToRequest` in `src/lib/mentorship.ts`). MAARG's own materials
   describe its matching as "AI/ML-powered" without publishing the model.
   Rather than imitate an opaque label, this release adds a second,
   *disclosed* ranking factor on top of D-008's tag overlap: each mentor's
   live count of currently-accepted mentees vs. their stated
   `capacity_per_month`. A mentor at capacity is never hidden (a founder
   can still see and message them) but ranks below an equally-relevant
   mentor with room, and — the enforcement half, which D-008 left as a
   stored-but-ignored number — a mentor cannot `accept` a request that
   would put them over their own stated capacity. The error message tells
   them exactly why and what to do (raise capacity, or complete an
   existing mentorship first).
2. **Shared next-check-in date** (`next_checkin_at` column, migration
   `003_mentor_depth.sql`; `setNextCheckin`). Two real mechanics converge
   on one honest field: MAARG's stated "meeting scheduler" feature, and
   Wadhwani's structured check-in cadence (its Accelerate programme's
   stated 9-month milestone check-in, generalized here to any accepted
   relationship, not just one flagship programme tier). This is
   deliberately just a shared date either participant can set — not a
   real calendar/video integration, and never presented as more than a
   plain date field. An accepted request with a past `next_checkin_at`
   is flagged "overdue" in the UI.
3. **Institutional Mentor Coverage** (`computeMentorshipCoverageForCohort`,
   surfaced per-cohort on `/dashboard/institution`). YUKTI/IIC's role for
   MIC — give an institution a live aggregate signal of real activity —
   reimplemented at the scope this app actually has: for a cohort's real
   enrolled founders, a live COUNT of how many have an active/completed
   mentor relationship, how many sessions have been logged, and how many
   accepted relationships have an overdue check-in. No claim of any
   connection to ARIIA, IIC Star Rating, or any government system — see
   the correction in the compare.html artifact's YUKTI profile for why
   that link doesn't actually exist the way an earlier draft implied.

**What was deliberately NOT added (still real gaps, tracked in
`docs/ROADMAP.md`):** mentor vetting/credentialing (neither MAARG's nor
Wadhwani's public materials document their own vetting process in enough
detail to model honestly, so none is modeled here — a mentor profile is
still "anyone with an account"), a faculty-enablement/train-the-trainer
track (Wadhwani's actual scale mechanism — training an institution's own
staff rather than routing every founder through outside mentors — is a
different, larger feature than anything shipped this pass), and any
reporting-mapping output aimed at IIC/YUKTI or a government portal (still
Planned, still will never auto-submit once built, per the standing rule).

**HTML prototype:** unchanged again, for the same reason as D-008's
resync decision — capacity-aware matching, cross-user requests, and
institutional coverage all require real, separate accounts and
server-side state that a single-user client-only `localStorage` app
cannot honestly provide. Resynced (no content diff) rather than adding a
faked, single-user mock of a fundamentally multi-user feature.

**Verification:** `tests/mentorship.test.ts` grew three new tests
(capacity enforcement at accept-time, capacity-aware ranking with a tied
tag-overlap score, and coverage correctness against a real enrolled
cohort with a mix of matched/unmatched founders and an overdue check-in)
— 9/9 passing. A dedicated Playwright script exercised the full UI path
(capacity badge → at-capacity block → accept → overdue flag →
institution-side coverage line with real numbers) with zero console
errors.

## D-010 — Real CI, and a DPDP Act 2023-shaped consent/guardian/data-rights layer

**Ask:** "Which tasks can be built by claude itself? I want to keep most
of the services free and efficient, except services like blueprint/dpr/
pitch deck etc" — following the productization-roadmap discussion
(`productize.html`), build the items identified as free/buildable without
a paid vendor, starting with CI and the DPDP-shaped data model that blocks
honestly onboarding any real minor (explorer, 13-17) user.

**What was added:**

1. **Real CI** (`.github/workflows/ci.yml`). Runs on every push/PR: spins
   up an ephemeral Postgres service container, applies every migration,
   runs the actual test suite (`npm test` — now 14 tests across
   `rbac.test.ts` (4), `mentorship.test.ts` (5), `consent.test.ts` (5)), lints, and
   does a production build. Free on GitHub Actions (public repos: unlimited
   minutes; private on the free plan: 2,000 min/month, far more than this
   suite needs) — no paid CI vendor.
2. **Guardian relationships** (`guardian_relationships` table,
   `src/lib/consent.ts`). An explorer-band account can add a guardian's
   name/email; the guardian confirms via a token-bearing link at the
   public `/guardian-confirm` page (no login required — a guardian is very
   unlikely to have a Z Cubs account). Stated honestly, here and on the
   page itself: "confirmed" means whoever holds the link clicked it, not
   an identity-verified guardian — the same bar most consumer double
   opt-in flows use without a paid ID-check vendor. No email-sending
   service is wired up yet (a real, separate follow-up — see
   `docs/ROADMAP.md` Planned notifications item), so the confirm link is
   shown to the founder to pass along, rather than faking a "sent" state.
3. **Consent records** (`consent_records`, append-only). A real consent
   trail — every grant/withdraw decision is a new row, never an
   overwritten flag — surfaced on the new `/dashboard/privacy` page.
4. **Data-subject-rights requests** (`data_requests`, `exportUserData`,
   `executeDataDeletion`). "Download my data" (`/api/privacy/export`) runs
   a real live query across every table a founder owns rows in and returns
   real JSON, never a cached or fabricated summary, and always excludes
   the password hash. Deletion is filed as a `pending` request rather than
   auto-executed — the same "prepared, human-reviewed" pattern already
   used for institutional reporting exports — and `executeDataDeletion` is
   a separate, explicitly-called function a human triggers, running in one
   transaction (deletes owned rows, anonymizes the account row, marks the
   request completed).

**What was deliberately NOT claimed:** this is a data model and an honest
workflow, not a legal opinion. The actual Terms of Service / Privacy
Policy text, and whether this data model actually satisfies the DPDP Act
2023 in full, still needs a real lawyer's review before this is relied on
with real minors — stated on the `/dashboard/privacy` page itself, not
just in this log. No identity verification of guardians is performed or
implied. `hasConfirmedGuardianConsent` is exposed as a gate for future
features but is not yet wired into any existing founder-lab code (Explorer
safeguards remain the advisory-copy-only state already tracked as Planned
in `docs/ROADMAP.md`).

**Verification:** `tests/consent.test.ts` (5 new tests: pending → wrong
token rejected → confirmed with a real consent_records row; revocation
writes a granted=false row; `getConsentStatus` collapses to latest-per-type
while `listConsentHistory` keeps every row; `exportUserData` returns real
rows and excludes the password hash; `executeDataDeletion` removes owned
rows and anonymizes the account) — full suite now 14/14 passing. A
dedicated Playwright script exercised the full UI path (explorer signup →
grant/withdraw consent → add guardian → confirm via the public link in a
separate, logged-out browser context → status flips to confirmed on the
founder's page → live JSON export with no password hash → deletion request
recorded as pending) with zero console errors. `npm run build` (production)
and `npm run lint` both pass with the new routes included.

## D-011 — Plan/tier data model with enforcement, and AI usage quotas / cost guardrails

**Ask:** "what else can be built by claude?" → "yes" — continuing the
free/buildable list from the productization-roadmap discussion
(`productize.html`), specifically the two items flagged as blocking safe
monetization and safe AI spend: a real plan record with enforcement, and a
cost ceiling on the AI layer.

**What was added:**

1. **`user_plans`** (`src/lib/plans.ts`). Every user has a real plan row —
   `free_explorer` by default, created lazily on first read rather than a
   migration backfill. `setUserPlan(userId, plan, setBy, note)` changes it;
   `setBy` records how (`'admin'` today; a real payment-provider webhook
   name once one exists). **No checkout flow was added.** Z Cubs has no
   payment processor connected (`docs/productize.html` "Money" layer), so a
   self-serve "Upgrade" button that doesn't actually charge anyone would be
   dishonest — `/dashboard/pricing` now shows which real plan you're on and
   says explicitly that plan changes are admin-set for now, rather than
   pretending a checkout exists.
2. **AI usage quotas** (`ai_usage_events`, `src/lib/aiQuota.ts`,
   `callClaudeForUser` in `src/lib/aiClient.ts`). Two real ceilings, both
   computed from actual logged rows, not estimates: a **per-user daily
   limit that scales with plan** (`PLAN_AI_DAILY_LIMITS` — tightest on
   `free_explorer`), and a **hard platform-wide daily cap**
   (`AI_GLOBAL_DAILY_CALL_CAP`, default 300) that applies regardless of
   plan — so even if every account were on the most generous tier, a bug
   or a traffic spike can't produce a runaway bill with no alerting to
   catch it (no billing/alerting vendor is connected yet either). All four
   real `callClaude` call sites (`/api/suggest`, `/api/generate-idea`, the
   mentor-chat action, and Guide field drafting) now go through
   `callClaudeForUser`, which checks quota, records the attempt (allowed
   or blocked, for later cost-attribution by feature), and returns `null`
   on a block — exactly the same signal as "no API key configured" — so
   every caller's existing honest fallback path handles quota exhaustion
   for free for the same behavior.
3. **The bulk Guide "start from a template" flow** (`generate-guide-all` →
   `populateStepContent` → `draftGuideFieldText`, threaded with `userId`)
   was the actual motivating case: it can fire dozens of real AI calls in
   one request across 20 steps. No special-casing was needed — once quota
   is hit mid-loop, every later field in the same request just falls back
   to the honest non-AI scaffold already used when no key is configured;
   the founder sees a gradually more scaffold-heavy result, never an error.
4. **`/dashboard/pricing`** now shows the real plan and a live "AI drafts
   used today: N / limit" line — a cost guardrail surfaced before someone
   hits it silently, not a paywall message.

**What was deliberately NOT built:** no payment processor integration
(Razorpay/Stripe — still Planned, still requires a real merchant account
only a human/business entity can hold), no self-serve upgrade flow, and no
feature-gating tied to plan beyond the AI draft allowance — the founder
labs, mentor discovery, and everything else stay exactly as free and open
as before this change. When the Blueprint/DPR/pitch-deck export generator
(still explicitly Deferred, per `docs/ROADMAP.md`) is eventually built, it
is the natural first feature to gate on a paid plan via this same
`getUserPlan`/`PLAN_CODES` mechanism, rather than something to build now.

**Verification:** `tests/plans-and-quota.test.ts` (5 new tests: default
plan lazily created; `setUserPlan` changes it and rejects an unknown code;
a user is blocked once their plan's ALLOWED-call limit is reached, and a
blocked attempt doesn't itself count against the limit; a paid plan gets a
strictly higher limit than free; the platform-wide cap blocks a brand-new
user with zero usage of their own once the global count is spent) — full
suite now 19/19 passing. `npm run lint` and a production `npm run build`
both pass with the new/changed routes included. A Playwright script
confirmed `/dashboard/pricing` shows the real plan, "0 / 5 used today" for
a fresh Free Explorer account, and that the AI-disabled sandbox (no
`ANTHROPIC_API_KEY` configured here) correctly short-circuits before
touching the quota counters at all — zero console errors.

## D-012 — Real server-side enforcement of Explorer-mode (13-17) safeguards, narrowly scoped

**Ask:** "guardian consent enforcement" as the next item from the
free/buildable list — then, mid-build, a fair challenge: "this is only an
educational, mentorship platform, not incorporation, and not storing
personal data — why is guardian consent required?"

**That pushback was answered directly before continuing, not brushed
past:** the app already stores real personal data of a minor from the
moment of signup (name, email, then everything typed into every founder
lab) — under India's DPDP Act 2023 the child-consent trigger is *any*
processing of a child's personal data, not incorporation status or a
specific sensitive-data threshold, so "just educational" doesn't exempt
it. More concretely: Mentor Discovery (D-008/D-009) puts a 13-17 year old
into 1:1 messaging with an adult verified by nothing more than having a Z
Cubs account — that is a real adult-minor contact surface independent of
any law. The user's counter-scoping point was fair and adopted: nothing
about signing up or using the educational content (Self Discovery,
Opportunity Cards, Evidence Lab, Guide) was ever gated, and D-012
deliberately keeps it that way — only two specific real-world-risk actions
are gated, chosen by the user from three options presented via
AskUserQuestion (narrow gate / drop enforcement entirely / institution-level
consent instead) — they picked the narrow gate.

**What was added:**

1. **Structured, self-declared experiment risk flags**
   (`involves_money`, `involves_contract`, `involves_stranger_contact` on
   `experiments`). Deliberately NOT a keyword scan of the free-text
   hypothesis/method fields — that would be an unreliable guess dressed up
   as detection, exactly the kind of fabricated-signal the evidence-
   governance rule exists to prevent. Three honest checkboxes on
   `ValidationForm.tsx`, self-declared by the founder.
2. **`repo.createExperiment`** now rejects saving a risk-flagged experiment
   for an Explorer-band account with no confirmed guardian relationship
   (D-010's `hasConfirmedGuardianConsent`) — enforced in the data-access
   function itself, not just a hidden button, the same pattern as every
   other real enforcement in this codebase (D-005 RBAC, D-009 mentor
   capacity).
3. **`mentorship.requestMentorship`** gates the same way: an Explorer
   founder cannot send a mentor request without a confirmed guardian —
   because a mentor is an adult verified by nothing more than an account.
4. **Money Lab was deliberately NOT touched.** It was checked and found to
   be a pure financial-projection calculator — no real money changes
   hands, no real transaction occurs — so gating it would have been
   theater, not safety. This corrects `docs/ROADMAP.md`'s earlier,
   imprecise claim that "the Money Lab and Validation Lab UIs carry
   advisory copy already"; the actual advisory text lives only in the
   seeded programme journey's `youthSafetyNote` fields, not on either lab
   page, and only Validation Lab (real-world experiments) plus Mentor
   Discovery (real adult contact) presented an actual safety surface.
5. Both gated pages show a **proactive notice** (not just a rejection
   surprise) to an Explorer account with no confirmed guardian, linking to
   `/dashboard/privacy`, and the mentor-request form is replaced with an
   explanatory message the same way an at-capacity mentor already is
   (D-009) — the founder sees why before hitting an error, not after.

**What this does NOT do:** it does not require guardian consent to sign up
or use any educational content; it does not attempt to detect risk from
free text; it does not touch Money Lab; and it does not claim legal
compliance — this is enforcement of a narrow, real safety surface, still
subject to the same "not a lawyer" caveat already stated in D-010.

**Verification:** `tests/explorer-safeguards.test.ts` (5 new tests: a
risky experiment is blocked for an unconsented Explorer; a non-risky one
is not; the same account can save a risky one once a guardian is
confirmed; an adult account is never gated regardless of flags; an
Explorer founder is blocked from, then able to, request a mentor) — full
suite now 24/24 passing. `npm run lint` and a production `npm run build`
both pass. A Playwright script confirmed the proactive notices render,
non-risky experiments save normally for an unconsented Explorer, a
risky-flagged one is actually blocked (not just visually hidden), and the
mentor-request form is replaced with the guardian-required message —
zero console errors.

## D-013 — Mentor self-attestation (real, honestly labelled — not a fake background check)

**Ask:** continuing the free/buildable list — "mentor self-attestation
next, since it's the one still-open trust gap that directly follows from
the guardian-consent work."

**Decision:** close "opening a mentor profile requires nothing beyond an
account" (flagged in `docs/ROADMAP.md` since D-009) the same way D-009
handled MAARG's undisclosed "AI/ML-powered" matching claim — replace an
opaque gap with a real, disclosed mechanic, not a fabricated one. Neither
Wadhwani's nor MAARG's own public materials document a vetting process in
enough detail to model honestly (D-009's original reasoning for building
nothing here), so this does not pretend to run a background check. It adds
exactly two real things: a **required, self-declared credentials
statement** and an **explicit attestation checkbox**, both shown back to
founders labelled "Self-declared, not verified by Z Cubs" — never
implied to be more.

**What was added:**

1. `mentor_profiles` gained `credentials_note`, `attestation_confirmed`,
   `attested_at`, and an optional `reference_name`/`reference_email`/
   `reference_relationship`.
2. `upsertMentorProfile` (`src/lib/mentorship.ts`) now rejects saving a
   profile — create OR edit — without a non-empty credentials statement
   and a confirmed attestation checkbox. Every save re-confirms
   (`attested_at` reflects the most recent save, not just the first).
3. The reference contact is optional and explicitly a self-provided lead,
   never something Z Cubs contacts on the mentor's behalf — stated on the
   form and on the founder-facing card.
4. Founders see the credentials note, the "self-declared, not verified"
   badge, and the reference contact (if provided) directly on each match
   card on `/dashboard/mentors` — real transparency in place of blind
   trust, not a hidden vetting step.
5. `docs/ROADMAP.md`'s Mentor vetting/credentialing entry is updated to
   describe this real, narrow layer, still explicitly distinguished from
   an actual background check.

**What this does NOT do:** it does not verify anything the mentor writes,
does not contact the reference, and does not block a mentor from writing
something untrue — the honesty is in the label shown to founders, not in
detection. This is a real, adopted limitation, not a placeholder.

**Verification:** `tests/mentor-attestation.test.ts` (6 new tests: missing
credentials rejected; missing attestation rejected; a valid save gets a
real `attested_at`; an optional reference is stored when given and empty
by default; editing re-requires the same validation; the mentor-listing
query surfaces the new fields, not just the base profile columns) — full
suite now 30/30 passing. `npm run lint` and a production `npm run build`
both pass. A Playwright script confirmed the HTML5-required fields block
a bare submit, a complete submission saves and reloads correctly, and —
separately, as a different account — a founder viewing the match list
actually sees the self-declared credentials, the "not verified" badge,
and the reference contact on the mentor's card, zero console errors.

## D-014 — Cohort scoping of founder work

**Ask:** the previous release ("what else needs to be done to make it a real
product") named this as the first remaining piece of real UI wiring: the
`opportunities` table already carries `institution_id`/`programme_id`/
`cohort_id` columns, and enrolment already records a founder's cohort
membership in `cohort_memberships`, but nothing connected the two — a new
Opportunity Card was never actually stamped with the founder's real cohort
context, and the founder-facing UI never showed it either.

**What was found:** `createOpportunity`'s input type explicitly excluded
all four scoping fields and its INSERT never set them — confirmed they were
always NULL. `institutional.ts` had every "downward" lookup (institution →
programme → cohort → members) but no "upward" one (a founder's own userId →
their active cohort). A stale code comment inside `enrolFounderInCohort`
claimed "scoping applied at Opportunity-create time via cohort context" —
that was not true when found; it described the feature this decision
actually builds. Corrected, not left silently wrong, per this project's
standing rule.

**Decision:** add the missing reverse lookup, then wire `createOpportunity`
to use it automatically — never fabricated, never defaulted to a "demo"
institution; a founder with no active cohort membership still gets NULLs,
exactly as before this release.

**What was added:**
- `getActiveCohortMembershipForUser(userId)` (`src/lib/institutional.ts`) —
  a founder's own most recent ACTIVE `cohort_memberships` row, or
  `undefined` if none.
- `getFounderProgrammeContext(userId)` — resolves the full real chain
  (membership → cohort → programme → institution) in one call, or
  `undefined` if the founder isn't enrolled anywhere.
- `createOpportunity` (`src/lib/repo.ts`) now calls
  `getFounderProgrammeContext` and stamps `institution_id`/`programme_id`/
  `cohort_id` on the new row when a real membership exists.
- Founder-facing UI wiring: `/dashboard` shows a real "you're enrolled in
  X's Y programme, cohort Z" notice when a context exists (nothing shown
  otherwise); `/dashboard/opportunities` shows the same programme/cohort
  context above the card grid, and every card that carries a `cohort_id`
  is labelled with the real cohort/programme name it was actually stamped
  with at creation (looked up per-card, not assumed to match the founder's
  *current* cohort, in case a founder is ever re-enrolled elsewhere later).
- Corrected the stale `enrolFounderInCohort` comment to describe the real
  mechanism (lazy lookup at Opportunity-create time), not a claim that
  nothing implemented it yet backed up.

**What was deliberately NOT done:**
- No retroactive backfill of `institution_id`/`programme_id`/`cohort_id`
  onto Opportunities created before this release, or before a founder's
  enrolment — those rows keep their real (NULL) history rather than being
  rewritten to imply a scoping that didn't exist at the time.
- No UI to let a founder pick a *different* cohort to scope a card to —
  scoping is always derived from the founder's own real, active membership,
  never a free-text or dropdown choice, to keep it tamper-proof.
- Mentor pools scoped to a programme/cohort, and the institution-side
  cohort dashboard actually *filtering* by this new scoping, remain
  **Partial**/**Planned** — this decision only closes the founder-facing
  half named in the roadmap.

**Verification:** `tests/cohort-scoping.test.ts` (3 tests: no membership →
NULLs, real membership → real stamped IDs, `getFounderProgrammeContext`
resolves the full chain and returns `undefined` when unenrolled) — full
suite now 33 tests, all passing. `npm run lint` clean (pre-existing
`no-page-custom-font` warning only). `npm run build` succeeds. Live
Playwright verification: seeded a real institution/programme/cohort
directly in Postgres, signed up a founder, confirmed no scoping notice
appears pre-enrolment on either `/dashboard` or `/dashboard/opportunities`,
enrolled the founder into the seeded cohort, confirmed both pages then show
the real institution/programme/cohort names, created a new Opportunity Card
as that founder, and confirmed it renders "Scoped to <real cohort> · <real
programme>" — no console errors.

## D-015 — Evaluation rubric & scoring

**Ask:** the second item named on the remaining-work list: `evaluation_rubrics`/
`evaluation_criteria`/`evaluation_scores` tables existed since D-006, and
`submitEvaluation` even accepted a `scores` parameter — but no rubric-builder
UI existed, no caller ever passed a real score, and the function's own body
never wrote to `evaluation_scores` at all. Every evaluation in this product,
until now, was reasoning-only.

**What was found:** `submitEvaluationAction` called `inst.submitEvaluation`
with a hardcoded `[]` for scores — confirmed by reading the call site, not
assumed. This means the "per-criterion scores" line in the previous
ROADMAP.md was accurate about the schema but the feature itself was fully
unbuilt, exactly as that file already said (Partial, not Implemented) — no
correction needed there, just the build.

**Decision:** build the rubric builder and real scoring, keeping every
number honest: a rubric is never pre-seeded with example criteria (a real
rubric is the institution's own judgement call), an evaluator's weighted
total is `null` — never a fabricated `0` — when they scored nothing, and a
programme manager always sees exactly what each evaluator scored, never one
opaque merged "final score."

**What was added:**
- `getRubricForProgramme(programmeId)` — the rubric plus its ordered
  criteria, or `undefined` if none exist yet.
- `addEvaluationCriterion(actorUserId, programmeId, {label, weight, kind})`
  — RBAC-checked (institution owner/administrator/programme manager only);
  lazily creates the rubric row on the first criterion.
- `removeEvaluationCriterion(actorUserId, programmeId, criterionId)` —
  scoped by a join against the *calling* programme's own rubric, so a role
  holder on programme B cannot delete a criterion that belongs to
  programme A even if they guess its id.
- `submitEvaluation` now actually persists `{criterionId, score}` pairs
  into `evaluation_scores` (upsert on `(evaluation_id, criterion_id)`) —
  previously accepted-and-dropped.
- `listEvaluationsForApplication(applicationId)` — every evaluator's
  reasoning plus their real persisted scores, joined against each
  criterion's real weight, with a computed weighted average (`null` when
  no criteria were scored).
- UI (`/dashboard/institution`): a "+ Evaluation rubric" panel per
  programme to add/remove weighted criteria (label, weight 1-10, kind);
  the evaluation form now renders one numeric input per real criterion
  (0-10, half-point steps) alongside the existing free-text reasoning
  field; submitted evaluations show their weighted score and how many of
  the programme's criteria were actually scored.

**What was deliberately NOT done:**
- No default/example criteria seeded for a new programme — an empty
  rubric with an honest "0 criteria" count is the accurate starting state.
- No single combined multi-evaluator "final score" computed or displayed
  — each evaluator's weighted total is shown separately; combining them
  into a selection ranking remains a human judgement made via the existing
  select/not-selected actions, not an automated recommendation.
- Blind review (`is_blind_review` on the rubric) is still not surfaced in
  the UI — the column exists and defaults false; a real blind-review flow
  (hiding applicant identity from the evaluator) is a separate, larger
  follow-up, not bundled into this decision.
- No score-editing UI for a criterion once evaluations reference it —
  `weight`/`kind` can only be set at creation via the add-criterion form;
  changing an existing criterion's weight after evaluations exist would
  silently change past weighted totals, so that's left for a real edit
  flow later rather than done here implicitly.

**Verification:** `tests/evaluation-rubric.test.ts` (5 tests: no
pre-seeded rubric, only-a-real-role-holder can add a criterion, weighted
average computed correctly from real weights, `null` — not `0` — when
nothing was scored, and cross-programme criterion removal is blocked) —
full suite now 38 tests, all passing (one flaky run during this session
traced to a `Date.now()`-only test-email collision across back-to-back
runs, not a real failure — re-run passed clean). `npm run lint` clean
(pre-existing warning only). `npm run build` succeeds. Live Playwright
verification: created a real institution/public programme as an
institution owner, added two weighted criteria (weight 1 and weight 3)
through the rubric UI, had a separate founder account submit a real
application, assigned the owner as evaluator, submitted scores of 4 and 8
through the rendered per-criterion inputs, and confirmed the UI displays
"Weighted score: 7.0" — the correct weighted average — alongside the real
reasoning text, with no console errors.

## D-016 — Cohort transfer, deferral & graduation

**Ask:** the third item on the remaining-work list: `cohort_memberships.status`
has supported `graduated`/`withdrawn`/`deferred` since D-004, but no code
anywhere ever wrote anything other than `'active'` — there was no action to
mark a founder graduated, deferred, withdrawn, or to move them to a
different cohort.

**Decision:** add real status-change and transfer actions, RBAC-checked the
same way as every other cohort write (a role at cohort/programme/
institution scope), and scope transfer to cohorts within the same programme
— a deliberate, honest boundary rather than a generic "move anywhere"
action (see below).

**What was added:**
- `updateCohortMembershipStatus(actorUserId, membershipId, status)` — sets
  a membership to `active`/`graduated`/`withdrawn`/`deferred`; rejects an
  invalid status and requires a real role at the membership's cohort (or a
  broader programme/institution role).
- `transferCohortMembership(actorUserId, membershipId, targetCohortId)` —
  requires a real role on BOTH the source and target cohort, requires the
  membership to currently be `active`, and requires both cohorts to belong
  to the same programme. Marks the old membership `withdrawn` (never
  deleted — it stays on the audit trail) and reactivates or creates the
  target membership as `active`. Because D-014's cohort-scoping lookup
  reads the founder's most recent ACTIVE membership, a transferred
  founder's next new Opportunity Card is automatically scoped to the new
  cohort — no separate wiring needed.
- `listCohortMembersWithNames(cohortId)` — the roster joined with each
  founder's real name/email, for the UI below.
- UI (`/dashboard/institution`): each cohort now has a collapsible roster
  showing every founder's real name, email, and status, with an inline
  status-change dropdown and a "Transfer to…" control (disabled unless the
  membership is currently active).

**What was deliberately NOT done:**
- Transfer across different programmes or institutions — the RBAC model
  already requires a role on both cohorts, but a cross-programme move
  raises real questions (does the founder's existing Opportunity/evidence
  history follow them? which institution's dashboard reports them?) that
  this decision doesn't answer, so it's explicitly rejected with a clear
  error rather than silently allowed.
- No bulk/CSV roster actions — one founder, one action, same as every
  other write in this release.
- No notification to the founder when their status changes or they're
  transferred — real notifications remain **Planned** (see below);
  founders can already see their own current cohort context on
  `/dashboard` (D-014).

**Verification:** `tests/cohort-lifecycle.test.ts` (5 tests: default
active + RBAC-checked status change, invalid status rejected, transfer
withdraws the old membership/activates the new one AND a subsequent
Opportunity Card scopes to the new cohort, cross-programme transfer
rejected even with a real role on both cohorts, non-active memberships
can't be transferred, and the roster surfaces real names/emails) — full
suite now 43 tests, all passing. `npm run lint` clean (pre-existing
warning only). `npm run build` succeeds. Live Playwright verification:
created a real institution/programme with two cohorts, enrolled a founder,
opened the roster and confirmed it shows their real name and email,
graduated them through the UI and confirmed the status updated, then
transferred them to the second cohort and confirmed via direct DB query
that the original membership is `withdrawn` and the new one is `active`
— no console errors.

## D-017 — Load-test scripts

**Ask:** the next item on the remaining-work list — no load testing existed
anywhere in the project; `.github/workflows/ci.yml` (D-010) runs unit
tests/lint/build on every push, but nothing measured how the app behaves
under concurrent traffic.

**Decision:** use k6 (free, open-source, no paid load-testing vendor —
consistent with this project's "keep it free where real" pattern) and
script real user journeys against the real running app: real signup, real
NextAuth login, real page loads. No mocked auth, no fixture data, no
synthetic in-process benchmark standing in for an HTTP load test.

**What was added:**
- `scripts/loadtest/lib.js` — shared `signUpAndLogIn()` (real
  `/api/signup` call + real NextAuth CSRF/credentials login flow) and
  `get()` (GET + status-200 check) helpers.
- `scripts/loadtest/smoke.js` — unauthenticated: home/login/signup pages,
  ramping to 10 concurrent VUs.
- `scripts/loadtest/founder-journey.js` — each VU signs up and logs in as
  a real founder, then reads dashboard/opportunities/validation/mentors/
  passport/guide, ramping to 20 concurrent VUs over 3 minutes.
- `scripts/loadtest/institution-dashboard.js` — same pattern against
  `/dashboard/institution`, the heaviest page in the app (several nested
  async components per programme).
- `scripts/loadtest/README.md` — how to run these, what the thresholds
  mean, and the honest scope note below.
- `package.json` gained `loadtest:smoke`/`loadtest:founder`/
  `loadtest:institution` scripts (thin wrappers around `k6 run` — k6 itself
  is not an npm package and must be installed separately, documented in
  the README).

**What was deliberately NOT done — and why, honestly:**
- These scripts load-test PAGE READS, not the write actions inside those
  pages. Every write in this app is a Next.js Server Action, invoked over
  a wire protocol keyed to a build-specific action id — not something a
  script outside the running app can reliably target. The write paths
  already have real automated coverage in `tests/*.test.ts` (43 tests)
  exercising the same service-layer functions the UI calls; what was
  missing, and what this decision adds, is concurrent read-latency
  measurement, which unit tests don't provide.
- Not wired into `.github/workflows/ci.yml` — a load test needs a running
  server and takes minutes, a different shape of job than the existing
  fast unit-test/lint/build run. Left as a manually-run (or later,
  separately-scheduled) job — see ROADMAP.md.
- No load test against a real deployed/staging environment was run as
  part of this decision (no such environment exists yet — see the
  still-Planned backup/deploy config work) — verification below is against
  a local dev server.

**Verification:** installed k6 v0.54.0 locally and ran all three scripts
against a real local `next start` server on the project's own dev
Postgres. `smoke.js`: 900/900 requests, 0% failures, p95 17.85ms — both
thresholds passed. `founder-journey.js` (verified with a shortened
duration to fit this session's tooling, thresholds/stages unchanged in
the delivered file): 198/198 requests, 0% failures, p95 204ms (threshold
1500ms) — every real signup and login succeeded. `institution-dashboard.js`
(same shortened-duration verification approach): 108/108 requests, 0%
failures, p95 97.5ms (threshold 2000ms). Cleaned up all
`@loadtest.example.com` test accounts afterward (`DELETE FROM users WHERE
email LIKE '%@loadtest.example.com'` — 49 rows).

## D-018 — Backup & free-tier deploy configuration

**Ask:** the next item on the remaining-work list — no deployment config
or backup mechanism existed anywhere in the repo. `.env.example` and
several test files already said "see docs/DEPLOYMENT.md" — that file
never existed. A real, previously-undocumented gap, closed here rather
than left silently broken (consistent with this project's practice of
fixing found inaccuracies visibly).

**What was researched before building anything:** current free-tier terms
for Render (web services and Postgres), Neon (Postgres), Fly.io, and
Cloudflare R2 were looked up directly from each provider's own pricing/
docs pages rather than assumed from training data, since pricing and
free-tier terms change and this file makes specific claims about them.
Found: Render's free Postgres expires after 30 days (not viable for real
data); Render's free web service spins down after 15 minutes of no
traffic with a ~1 minute cold start, capped at 750 free instance-hours/
workspace/month; Neon's free Postgres plan is genuinely persistent (no
expiry), 0.5 GB storage, 100 CU-hours/month compute, no card required;
Render Cron Jobs cost at least $1/month (not actually free, despite one
search result's headline suggesting otherwise — checked Render's own docs
directly rather than trusting an aggregator site); Cloudflare R2's free
tier is 10 GB storage with no egress fees. This is why the deployment path
below combines Render (app) + Neon (database) rather than using Render for
both, and why backups run via GitHub Actions rather than a Render Cron Job.

**Decision:** ship a real, runnable free-tier deployment path and a real,
tested backup/restore pair — not a description of one.

**What was added:**
- `docs/DEPLOYMENT.md` (new — the file that was already being referenced
  but never existed) — local dev setup, the researched free-tier
  deployment path (Neon + Render) with real numbers and sources, backup/
  restore instructions, and an honest "what this does NOT give you"
  section (cold starts, no autoscaling, no staging split, Neon's
  compute-hours cap).
- `render.yaml` — a Render Blueprint for the Next.js app as a free web
  service; `DATABASE_URL`/`NEXTAUTH_URL` are left `sync: false` (set
  manually in the Render dashboard, never committed) and
  `NEXTAUTH_SECRET` is Render-generated, never hand-typed.
- `scripts/backup/backup.sh` — real `pg_dump` + gzip + upload to an
  S3-compatible bucket (R2 or equivalent); runs and produces a real local
  dump even with no bucket credentials set, and says plainly that nothing
  was uploaded rather than claiming success.
- `scripts/backup/restore.sh` — the companion restore script; refuses to
  run without an explicit `--yes-i-am-sure` flag and always prints exactly
  which database it's about to overwrite first (same "destructive actions
  are never auto-run" rule as D-010's data-deletion workflow).
- `.github/workflows/backup.yml` — runs `backup.sh` daily via GitHub
  Actions' own free runners (`workflow_dispatch` also allows an on-demand
  manual run); documents that private-repo Actions minutes draw from an
  account quota rather than asserting a specific number that could go
  stale.
- `.env.example` gained the previously-undocumented optional AI env vars
  (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_GLOBAL_DAILY_CALL_CAP`).

**What was deliberately NOT done:**
- No staging/production split or zero-downtime deploy — a single free
  web service is a demo/small-pilot deployment, explicitly labelled as
  such in DEPLOYMENT.md, not infrastructure sized for real launch traffic.
- No automated backup-restore drill (a scheduled job that restores the
  latest backup into a scratch DB and verifies it) — the restore path was
  verified manually once while building this (see Verification below); a
  recurring automated drill is a real follow-up, not built here.
- No alerting on a failed scheduled backup beyond GitHub's own Actions-tab
  failure indicator — no paid monitoring/paging service wired up.
- Render Cron Jobs were deliberately NOT used for scheduling backups,
  since they cost money even at minimum usage — GitHub Actions' free
  scheduled-workflow runners do the same job for free.

**Verification:** ran `scripts/backup/backup.sh` against this project's
real local dev Postgres database — produced a real 269,872-byte gzip dump
(no bucket credentials set, so it correctly reported no upload attempted
rather than a fake success). Restored that exact dump into a fresh scratch
database (`zcubs_restore_test`) with `scripts/backup/restore.sh`, first
confirming it refuses to run without `--yes-i-am-sure` (exit 1, no
changes made), then confirming a real restore with the flag — verified by
querying the restored database directly (`SELECT count(*) FROM users`
returned 898, matching the source database) before dropping the scratch
database. `render.yaml` and `.github/workflows/backup.yml` both validated
as parseable YAML. `npm run lint` clean (pre-existing warning only).
`npm test` — all 43 tests still pass (this decision touched no
application code, only new deploy/backup tooling and docs).

## D-019 — Terms of Service & Privacy Policy (first drafts)

**Ask:** the last item on the remaining-work list named to the user
before this round — a first-draft Terms of Service and Privacy Policy.

**Decision:** write both drafts from the real, built product — every
factual claim traces to a specific decision already documented in this
file — rather than starting from a generic legal template and editing it
to roughly fit. Both documents are explicitly labelled DRAFT, state
plainly that they are not legal advice and have not been reviewed by a
lawyer, and each ends with a "What still needs a lawyer" section listing
the specific open questions this draft could not resolve on its own
(liability language, jurisdiction-specific compliance determinations,
billing terms). This mirrors the same honesty boundary D-010 already drew
for the in-product Privacy & Consent page ("a data layer, not a legal
opinion").

**What was added:**
- `docs/legal/TERMS_OF_SERVICE.md` — covers what the Service is and isn't
  (grounded in the product's own existing footer disclaimer, quoted
  verbatim rather than rewritten), the three account types, content/data
  ownership, AI-assisted features and their opt-out-by-default/quota
  behavior (D-011), the mentor self-attestation model and its explicit
  non-vetting (D-013), the Explorer guardian-consent scope exactly as
  decided in D-012 (never signup or general use — only the two specific
  real-world-risk actions), institutional programme claims, the
  no-payment-processor-yet state (D-011) with an explicit note that
  billing terms are deliberately not written until a real payment flow
  exists, and a deliberately blank Section 10 (liability/warranty/
  governing law/disputes) rather than filled with unreviewed boilerplate.
- `docs/legal/PRIVACY_POLICY.md` — what's actually collected (traced
  column-by-column to real tables from D-004/D-006/D-010/D-011/D-012/
  D-013), what's explicitly NOT collected (payment/financial info,
  government IDs), the real working data-subject-rights features on
  `/dashboard/privacy` (export, deletion request, consent history) rather
  than policy language describing a feature that doesn't exist, the
  guardian double-opt-in model's real honesty boundary, and a children's-
  data section that states plainly it does not claim compliance with any
  specific law.

**What was deliberately NOT done:**
- No liability, warranty, governing-law, or dispute-resolution language —
  see Section 10 of the Terms of Service draft; filling this in without
  legal judgment would be worse than leaving it visibly blank.
- No billing/refund/cancellation terms — there is no payment flow yet to
  write terms for (D-011); adding them now would describe a feature that
  doesn't exist.
- No claim of DPDP Act 2023 compliance, COPPA compliance, or compliance
  with any other specific law — both drafts state their data model was
  *shaped by* DPDP Act 2023 as a reference point (consistent with how
  D-010 already described it), never that compliance has been confirmed.
- Not published anywhere in the live product (no footer link, no signup-
  flow acceptance checkbox added) — these are drafts for legal review,
  not yet wired up as binding terms a user is asked to accept, since
  asking someone to accept terms that admit they're unreviewed would be
  worse than not having terms at all.

**Verification:** both documents were fact-checked against
`docs/DECISION_LOG.md` line by line while writing — every specific claim
(guardian consent scope, mentor non-vetting, no payment processor, data
export mechanics, deletion review process) was matched back to the
decision that actually built it, not written from a generic template.
This is a documentation-only change — no application code was touched;
`npm run lint`/`npm test` were not re-run since nothing they cover
changed.

## D-020 — Razorpay integration for plan upgrades

**Ask:** "start on the Razorpay integration for the reports gate." Scoped
by the user's explicit choice (via a clarifying question, since the
`india_launch_pack` "Reports" tier is priced/gated conceptually in D-011
but the report generator itself doesn't exist yet): build the real
payment plumbing now — order creation, checkout, webhook, plan upgrade —
while the Reports feature stays a documented "coming soon." Nothing fake
ships behind the paywall; a user who pays for `india_launch_pack` today
genuinely gets that plan record and its already-real benefits (higher AI
draft allowance, etc.), just not a report generator that doesn't exist.

**Decision:** integrate Razorpay's real Node SDK and Standard Checkout,
with a hard architectural rule: the client-side checkout success callback
is never trusted to grant a plan upgrade. Only a signature-verified
webhook call from Razorpay's own servers does that — the same
server-side-enforcement convention this project already uses for RBAC
(D-005), guardian consent (D-012), and mentor attestation (D-013). Prices
are never invented by the product — each plan's price is a
`RAZORPAY_PRICE_INR_<PLAN_CODE>` env var the deployment operator sets; a
plan with no price configured is simply not self-serve purchasable
(deliberate for `institution`/`enterprise_government`, which this project
treats as negotiated sales, per D-011's honest framing).

**What was added:**
- `prisma/migrations/008_payments.sql` — `plan_purchases` table
  (`user_id`, `plan`, `amount_paise`, `razorpay_order_id` unique,
  `status` in `created`/`paid`/`failed`), applied to the local dev
  database.
- `src/lib/payments.ts` — `RAZORPAY_ENABLED` (true only once
  `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` are
  all set), `priceInrFor(plan)` and `getPurchasablePlans()` (env-var
  driven, never hardcoded), `createPlanOrder(userId, plan)` (creates a
  real Razorpay order via `instance.orders.create` and records it
  `created`), `verifyWebhookSignature(rawBody, signature)` (HMAC-SHA256
  over the raw body against `RAZORPAY_WEBHOOK_SECRET`), and
  `handleWebhookEvent(event)` — the sole place a plan is actually
  upgraded, via the existing `setUserPlan` (D-011), idempotent against
  Razorpay's own webhook-retry behavior (a re-delivered `payment.captured`
  for an already-`paid` purchase is a safe no-op, never a double credit).
- `src/app/api/payments/create-order/route.ts` — authenticated endpoint
  that only ever creates an unpaid order record; never upgrades a plan.
- `src/app/api/payments/webhook/route.ts` — deliberately unauthenticated
  (Razorpay calls it server-to-server); the HMAC signature check is what
  authenticates the caller. Always returns 200 once the signature is
  valid, so Razorpay doesn't retry-loop on event types this app
  deliberately ignores.
- `src/components/RazorpayCheckoutButton.tsx` — loads Razorpay's own
  Standard Checkout script on demand (never self-hosted/bundled — the
  checkout UI itself must be served from Razorpay's domain) and opens it
  for one plan; its success callback shows "processing," never "upgraded"
  — the real upgrade lands a few seconds later via the webhook.
- `src/app/dashboard/pricing/page.tsx` — wired the checkout button in per
  plan (only shown when a real price is configured and it isn't the
  user's current plan) and made the page's messaging conditional on
  whether Razorpay is actually configured on this deployment, rather than
  always describing a payment flow that might not exist.
- `.env.example` and `docs/DEPLOYMENT.md` — documented the four required
  env vars and the `RAZORPAY_PRICE_INR_<PLAN_CODE>` pattern, plus the
  Dashboard steps to get keys and register the webhook, with placeholder
  values only (per the standing secret-handling rule: `.env.local` is
  never included in distributed archives).

**What was deliberately NOT done:**
- The Reports feature itself (market/competitor reports, financial
  workbook, DPR, pitch deck generation) — still **Planned**; this
  decision only builds the ability to buy the plan that will eventually
  unlock it. The pricing page and this log say so plainly.
- Client-side payment-verification (`validatePaymentVerification`) —
  Razorpay's own npm package only publicly exports
  `validateWebhookSignature` (confirmed by reading the package's shipped
  `dist/razorpay.js` and type definitions directly, after
  docs.razorpay.com pages 404'd on fetch); relying on an internal,
  unexported utility for a security-critical check would be worse than
  the webhook-only design used here.
- Refunds, subscriptions/recurring billing, invoicing, or GST handling —
  this decision is a one-time order-to-plan-upgrade flow only.
- No proration or downgrade handling — buying a plan sets it outright
  (`setUserPlan`); moving between paid plans or handling a downgrade
  isn't addressed here.

**Verification:** `tests/payments.test.ts` (8 tests) — `priceInrFor`
correctly reads/validates env vars (including rejecting a negative or
non-numeric price), `getPurchasablePlans` lists only plans with a real
configured price, `createPlanOrder` rejects an unpriced or unknown plan
before ever calling Razorpay's API, `verifyWebhookSignature` accepts a
genuinely valid HMAC (constructed the same way Razorpay itself signs —
`hmac-sha256(secret, rawBody)`) and rejects a tampered body/wrong
signature/empty signature, `handleWebhookEvent` ignores event types it
doesn't act on and payloads with no matching order, upgrades the real
plan on `payment.captured` and is provably idempotent on a simulated
retry (plan is not re-applied or altered), and marks a purchase `failed`
on `payment.failed` without ever touching the user's plan. Full suite now
**51 tests, all passing** (43 prior + 8 new). `npm run build` and
`npm run lint` both clean (pre-existing unrelated warning only).
**Honestly not verified in this session:** an actual end-to-end order
creation against Razorpay's real API (test or live) — there were no
Razorpay test-mode credentials available in this environment. Everything
that doesn't require a live network call to Razorpay (signature
verification, price-config validation, the idempotent plan-crediting
logic, the full webhook state machine) was tested directly; a deployment
operator adding real test keys should do one manual checkout end-to-end
before enabling this for real users, per the steps in
`docs/DEPLOYMENT.md`.

## D-021 — Insight library (real founder work as human-reviewed AI reference material)

**Ask:** "How to make the users' actual work on the system in fact train
the system in real time in the background, so that the system understands
more of Gen Z and Gen Alpha thinking." Before building anything, this
needed a correction: the Anthropic API does not train or fine-tune on
what's sent to it (confirmed while researching D-011), and
`docs/legal/PRIVACY_POLICY.md` already promises "we do not use your
content to train external AI models" — a real-time background training
loop would have meant breaking that promise. The user, once this was
explained, asked for the honest version instead: a system where real user
work can still shape what the AI draws on, without silently retraining
anything or bypassing consent.

**Decision:** build a human-reviewed insight library — a founder can
explicitly opt one specific piece of their own work (starting with
Opportunity Cards) into a review queue; a platform administrator reads
the real submission, writes an anonymized version themselves, and only
that approved text is ever spliced into the AI's prompt as reference
material for other founders' drafts. No automatic ingestion, no
automatic anonymization, and nothing sent anywhere as training data —
this is the same "prompt sent to the AI provider to generate a draft"
data flow the Privacy Policy already discloses, just with better
reference material in it over time.

**What was added:**
- `prisma/migrations/009_insights.sql` — `insight_candidates` table
  (category, source user/ref, submitted text, status
  pending/approved/rejected, reviewer, anonymized text), with a unique
  constraint on the source reference so the same card can't be submitted
  twice.
- `src/lib/insights.ts` — `submitInsightCandidate` (opt-in only, gated
  behind confirmed guardian consent for Explorer accounts per D-012,
  records real consent via the existing `consent_records` mechanism from
  D-010 under a new `ai_insight_sharing` consent type), `listPending/
  approve/rejectInsightCandidate` (all require the pre-existing
  `platform_super_administrator` role from D-005's RBAC model — reused,
  not reinvented), and `getActiveInsightExamples` (returns only approved,
  human-written text — `[]`, never fabricated filler, until an admin has
  approved something for that category).
- `src/app/dashboard/admin/insights/page.tsx` — the review queue. Shows
  the real submitted text, requires the admin to type the anonymized
  version themselves (no auto-anonymize button to trust), and approve/
  reject. Not visible as a nav link — reached directly by URL, consistent
  with `platform_super_administrator` having no grant UI yet (see below).
- `src/app/dashboard/opportunities/page.tsx` — a per-card "Share to help
  train Z Cubs' AI" button plus an explanatory notice; a card that's
  already been submitted shows its status instead of a duplicate button.
- `src/app/api/generate-idea/route.ts` — when the AI path is used, up to
  2 real approved examples for `idea_generation` are added to the prompt
  as tone/style reference, explicitly labelled "do NOT copy them."
- `docs/legal/PRIVACY_POLICY.md` — a new disclosure section explaining
  exactly what sharing does, that it's opt-in per item, and that approved
  text is reference material, never training data — plus a fix to a
  stale line that still said no payment processor was connected (D-020
  had already made that false).

**What was deliberately NOT done:**
- No automatic anonymization or automatic promotion to "live." A human
  must read and rewrite every single example — the same trust boundary
  D-013 already drew for mentor credentials (self-attested, never
  auto-verified).
- No sharing UI for financial-model scenarios yet, even though the
  category (`financial_model`) already exists in the schema and the enum
  — `MoneyClient` is a client component with its own editing flow, and
  wiring a share action into it is a real, scoped follow-up, not built
  this round. Opportunity Cards were chosen first because they're the
  clearest, most self-contained real example.
- No admin console for granting `platform_super_administrator` itself —
  the same honest gap D-011 already names for setting a user's plan.
  Granting it today is a direct database action, not a UI flow.
- Nothing here changes how Anthropic's API is called or what it retains —
  no fine-tuning, no persistent memory on Anthropic's side. The "learning"
  entirely lives in Z Cubs' own database and prompt-construction code.

**Verification:** `tests/insights.test.ts` (7 tests) — empty/unknown-
category submissions rejected, a founder's submission is recorded pending
with a real consent record, duplicate submissions for the same card are
rejected, an Explorer account is blocked until a confirmed guardian
relationship exists (then succeeds), every admin action requires the
`platform_super_administrator` role, an approval requires real non-blank
anonymized text and only the anonymized text — never the raw original —
becomes an active example, and a rejected candidate never becomes active
and can't later be approved. Full suite now **58 tests, all passing**
(51 prior + 7 new). `npm run build` and `npm run lint` both clean.

**Also fixed while verifying:** running the full suite surfaced a real,
pre-existing flaky test (`D-010: getConsentStatus returns only the latest
decision per consent type`) — `recordConsent` was writing `created_at`
from a JS `Date` (millisecond resolution), so three consent decisions
recorded in quick succession could tie, making "the latest one" ambiguous
depending on tie-breaking. Fixed by having the INSERT use Postgres's own
`clock_timestamp()` (microsecond resolution, evaluated fresh per
statement) instead of a JS-computed timestamp — confirmed fixed by
running `tests/consent.test.ts` three times in a row with zero failures,
whereas it had failed roughly 1 run in 8 before the fix. Unrelated to
D-021's own logic, but a real correctness bug in a security-relevant
feature (consent status), left fixed rather than reported and ignored.

## D-022 — Faculty-enablement / train-the-trainer track

**Ask:** "build real scale adoption like that of Wadhwani [Foundation]."
Wadhwani's actual public-record scale mechanism (1,000+ institutions) is
training an institution's own staff to run sessions themselves, not
routing every founder through a scarce pool of outside mentors — but
"build adoption like theirs" cannot mean fabricating 1,000 institutions
or synthetic users; that would break this project's standing
no-fabrication rule (see every prior D-0XX entry). Presented three real
options via `AskUserQuestion`: the faculty-enablement software feature
itself, a go-to-market strategy document, or a clearly-labelled demo
dataset. The user chose the faculty-enablement track — already named as
a real, not-yet-built gap in `docs/ROADMAP.md`'s Partial section before
this decision.

**Decision:** build the real software feature behind that mechanism: a
new institution-scoped `cohort_facilitator` role, a per-week readiness
acknowledgement against the programme's own existing
`facultyGuidance`/`mentorPrompt`/`youthSafetyNote` text (D-006's
`DEFAULT_14_WEEK_TEMPLATE`, seeded once per programme by
`seedDefault14WeekJourney` — no separate training-content system
invented; the guidance text institutions already had is made into a
real, gated, read-and-acknowledge step instead of inert copy nobody was
ever shown), and a server-enforced gate: a staff member cannot log that
they ran a week's session for a cohort until they've acknowledged that
week's guidance. This is additive to Mentor Discovery & Matching
(D-008/D-009), never a replacement — an institution can use outside
mentors, its own trained staff, or both.

**What was added:**
- `prisma/migrations/010_facilitators.sql` — `facilitator_readiness`
  (programme, user, week, acknowledged-at, unique per triple) and
  `facilitated_sessions` (cohort, week, facilitator, summary, founders
  present, `clock_timestamp()`-based `ran_at` — same tie-avoidance
  pattern the consent fix above established).
- `src/lib/facilitators.ts` — `grantFacilitatorRole` (institution staff
  only, and only onto an existing institution member — reuses D-005's
  `requireAnyRole`/RBAC scope-chain, no new access-control mechanism),
  `listFacilitators`/`listInstitutionMembersWithNames`,
  `getWeekReadiness`/`acknowledgeWeekReadiness` (requires the
  `cohort_facilitator` role at/above the programme scope),
  `logFacilitatedSession` (requires the role at/above the cohort scope,
  and server-side blocks logging a week's session until that week's
  readiness is acknowledged — the actual "training" gate, not just a UI
  hint), `listFacilitatedSessions`, and
  `computeFacilitatorCoverageForCohort` (a live, honest aggregate: of
  this programme's real seeded weeks, how many has this cohort's own
  staff actually run themselves — modelled directly on D-009's
  `computeMentorshipCoverageForCohort`).
- `src/lib/actions.ts` — `grantFacilitatorRoleAction`,
  `acknowledgeWeekReadinessAction`, `logFacilitatedSessionAction`.
- `src/app/dashboard/institution/page.tsx` — a "Facilitators" panel per
  institution (grant the role to an existing member, by name/email, same
  pattern `assignEvaluatorAction` already used for evaluators); a
  per-programme "Your facilitator readiness" checklist showing the real
  week-by-week guidance and youth-safety text with an acknowledge button;
  a per-cohort session-logging form and log (week, what was covered,
  founders present); and an "Internal facilitation" coverage line next to
  the existing Mentor coverage line — both real, neither replacing the
  other.
- `docs/legal/PRIVACY_POLICY.md` / `docs/legal/TERMS_OF_SERVICE.md` — a
  short disclosure that a facilitator is an institution's own staff,
  designated by that institution (not vetted by Z Cubs, same trust
  boundary Section 5 already draws for mentor self-attestation), and can
  see the session summaries/headcounts they and their institution's other
  facilitators log.

**What was deliberately NOT done:**
- No certificate, badge, or completion score. Readiness is a plain
  acknowledgement of real, already-written guidance text — not a
  fabricated "trained" credential.
- No content-authoring UI for the guidance text itself in this round —
  the seeded `DEFAULT_14_WEEK_TEMPLATE` text is what's shown; editing it
  per-programme already existed nowhere before D-022 and still doesn't
  (a real, scoped follow-up, not this feature's job to add).
- No admin console for granting `cohort_facilitator` beyond the
  institution-staff-only form built here — but unlike
  `platform_super_administrator` (D-011/D-021's still-open gap), this one
  *does* have a real UI, since institution staff (not a platform admin)
  are the correct grantors.
- Facilitator sessions are not merged into `mentorship_sessions` or
  `computeMentorshipCoverageForCohort` — they're a deliberately separate
  table and aggregate, so "matched with an outside mentor" and "ran by
  our own trained staff" stay honestly distinguishable on the dashboard
  rather than blended into one misleading number.

**Verification:** `tests/facilitators.test.ts` (6 tests) — only
institution staff can grant the role, and only onto an actual institution
member; a facilitator cannot log a session for a week they haven't
acknowledged (then can, once they have); acknowledging readiness and
logging a session both require the `cohort_facilitator` role specifically
(plain institution membership isn't enough); the role granted at one
institution does not carry over to another institution's programme or
cohort (RBAC scope-chain isolation, same class of test as `rbac.test.ts`);
coverage reflects real logged sessions and stays additive to mentor
coverage, not a replacement; a blank session summary is rejected. Full
suite now **64 tests, all passing** (58 prior + 6 new). `npm run build`
and `npm run lint` both clean.

**Also fixed while verifying:** running the full suite surfaced a
pre-existing flakiness in `D-021: an approved candidate needs real
anonymized text...` (`tests/insights.test.ts`) — it called
`getActiveInsightExamples(category, 5)` and asserted
`after.length === before.length + 1`, which silently breaks once this
shared, persistent dev database has accumulated 5 or more approved
`financial_model` examples from earlier sessions' test runs (the count
gets capped at the limit on both sides, hiding whether approval actually
added one). Raised the test's limit to 10000 so the cap can't mask the
real assertion — confirmed fixed, `tests/insights.test.ts` now passes
cleanly. Unrelated to D-022's own logic, but a real test-isolation bug in
a data-integrity-relevant feature, left fixed rather than reported and
ignored.
