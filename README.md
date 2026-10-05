# Z Cubs — Co-built Venture Planning Platform

Co-built by **[Nishka Reddy Seelam](https://github.com/nishkareddyseelam-hash)** and **[Radhika Reddy Seelam](https://github.com/Radhi-N)** through shared research, discussions and AI-assisted development.

Nishka conceived and developed 14 founder-facing modules using Claude, including discovery, idea comparison, research, AI guidance and business planning. Radhika contributed the remaining modules, with particular ideation credit for the blueprint, pitch deck and DPR.

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the module allocation and [docs/NISHKA_DEMO.md](docs/NISHKA_DEMO.md) for a suggested demonstration.

**Snapshot:** uploaded D022 codebase. Repository preparation has not established a successful build or live deployment. Some original overview text predates later additions; check individual pages and docs/ROADMAP.md for feature status. Document/pitch generation remains planned.

---

# Z Cubs — Founder Operating System (Institutional Edition)

A real, full-stack working slice of the India-first, evidence-led Founder Operating System, now
with a multi-tenant institutional layer on top: Next.js (App Router, TypeScript) + PostgreSQL
(via a hand-written SQL schema + `pg` — see `docs/DECISION_LOG.md` D-007 for why not Prisma in
this environment) + NextAuth credential-based accounts + Server Actions for every mutation +
Tailwind + Framer Motion for the interactive UI.

**This release adds:** a tenancy hierarchy (Government Organisation → Institution → Programme →
Cohort → Venture Team → Founder Workspace), role-based access control enforced server-side on
every institutional write, an Institution onboarding flow, a Programme Builder that seeds the
configurable 14-week journey, cohort management, one fully connected vertical workflow —
application → evaluation → selection → cohort enrolment — and Mentor Discovery & Matching
(`/dashboard/mentors`): a Wadhwani-style structured, logged mentor relationship combined with
MAARG-style founder-driven ranked discovery (see D-008 in `docs/DECISION_LOG.md`). See
`docs/DECISION_LOG.md` for what was built and why, and `docs/ROADMAP.md` for what from the full
institutional spec is Planned rather than built in this release. Nothing in the UI claims a
capability that isn't real — Planned features are labelled as such, never simulated.

**Nothing in this app is fabricated.** Every screen is either a real, cited source (with a
publisher and URL — see `src/lib/realEvidence.ts`) or your own input, saved to your account.
Empty states say so honestly rather than showing invented data.

## What's built (Release 1 core slice)

- Real accounts: sign up, log in, password hashing, sessions (NextAuth + bcrypt)
- **Home & landing page** — the animated cub/tree mascot has been removed entirely. The landing
  page now leads with an interactive, no-fabricated-data product tour (`src/components/ProductTour.tsx`)
  and a working evidence-classifier demo; the dashboard home leads with a real Venture Readiness
  ring, a real momentum/streak/badges panel, and a compact live Founder World map — every number
  on both is computed from real data, never invented.
- **Gamification** (`src/lib/repo.ts` — `computeGamification`) — a day streak and a set of badges,
  computed only from a real, timestamped `activity_log` table of things you actually did in the
  workspace (saved a profile, added a card, ran an experiment, etc.). No fabricated stats.
- **Live, context-aware form suggestions** (`src/components/SmartSelect.tsx`, `SmartChips.tsx`,
  `src/app/api/suggest/route.ts`) — every major intake field (Self Discovery skills/time/capital/
  categories, Opportunity Card customer/mission, Validation method/KPI/threshold) is a dropdown of
  suggestions plus an always-available "Other — write my own" option. When `ANTHROPIC_API_KEY` is
  set (see Environment variables below), suggestions are generated live by Claude, tailored to
  what you've already typed elsewhere in the form; without a key, the same UI falls back to a
  curated, still-genuinely-useful static list — the UI is honest about which one produced a given
  list (see the "AI suggestions" vs plain label).
- **Trend Radar** (`src/app/dashboard/trends/page.tsx`) — real, sourced Gen Z/India sector signals
  with citations. Each category card has a working **+ Add to my Founder Fit Map** button that
  actually carries the sector into your Self Discovery categories (this was previously a dead
  link with no wiring at all — now fixed end to end).
- **Self Discovery** → Founder Fit Map, saved per account
- **Founder World** territory map (animated, honest "not started" states — no fake locks; a
  connected, progressively-drawn path rather than scattered dots, with a restrained pulse on the
  current territory and stationary, non-scaling labels)
- **Opportunity Forest** — create/delete your own Opportunity Cards
- **Idea Arena** — live weighted comparison; both weights and dimension scores are yours to set,
  persisted per idea, recomputes instantly
- **Evidence Lab & Market Observatory** — one real official citation (AISHE 2023-24 higher
  education enrolment, via the Ministry of Education / PIB) plus your own evidence register
- **Rival Radar** — real, sourced facts on NoBroker, Stanza Living and Zolo Stays
- **Validation Quest Lab** — experiment tracker (hypothesis/method/threshold/result), plus an
  explicit "did this meet its threshold?" verdict so the readiness score only credits genuinely
  validated evidence, never merely-recorded activity
- **Money Lab** — driver-based scenario financial model (conservative/base/upside), every
  assumption starts at zero and is yours to set, P&L recomputes live
- **Evidence Passport** — claims ledger, risk register, and a Venture Readiness score computed
  transparently from what you've actually filled in and verified (not a fabricated number)
- **India Launch Pack** and **Plans** screens — honestly marked as planned, not dead buttons
- Persistent AI mentor panel with four lenses (Coach/Teacher/Operator/Challenger) — calls Claude
  live when `ANTHROPIC_API_KEY` is set, grounded in your real session state each time; falls back
  to an honest, state-grounded template reply when no key is configured
- Light/dark theme, responsive layout, WCAG-conscious contrast, 18px minimum body text

## What's deliberately not built yet

Document generation (PDF/DOCX/PPTX exports), payments/billing, and the full evidence-connector
framework (live government data feeds) are out of scope for this slice — each is clearly labelled
"planned" in the UI rather than faked. (Institutional multi-tenant/cohort management and Mentor
Discovery & Matching are now built — see the Institutional Edition section above.)

## Running it locally

Requires Node.js 22+, and a running PostgreSQL 14+ instance.

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL to your Postgres connection string
npm run db:migrate           # applies prisma/migrations/*.sql (tracked in the _migrations table)
npm run db:migrate-sqlite    # ONE-TIME: only if you have an old data/zcubs.db to preserve (see D-003)
npm run dev
```

Open http://localhost:3000, click **Create your account**, and go.

For a production build:

```bash
npm run build
npm run start
```

To run the automated tests (requires `DATABASE_URL` set — these hit a real Postgres):

```bash
npm test
```

### Environment variables

Create `.env.local` from `.env.example`, set a unique `NEXTAUTH_SECRET`, and set `NEXTAUTH_URL` to your deployment domain. Never commit `.env.local`.

To turn on real, live AI suggestions and mentor replies (instead of the curated/template
fallbacks), add to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
# Optional — defaults to claude-sonnet-4-5-20250929
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

The key is only ever read server-side (`src/lib/aiClient.ts`) — it is never sent to the browser.
Every call has an 8-9 second timeout and fails soft to the curated fallback, so a slow or missing
key never breaks a form.

## Project structure

```
src/
  app/                  Next.js App Router pages
    dashboard/          the protected app (one folder per territory/screen)
    api/                auth + signup routes
    login/ signup/      auth pages
  components/           Shell (nav/mentor), ArenaClient, MoneyClient, shared UI
  lib/
    pg.ts               PostgreSQL connection pool + query helpers
    repo.ts             founder-domain data access (typed functions per model)
    institutional.ts    tenancy/RBAC/programmes/cohorts/applications/evaluation (new)
    mentorship.ts        mentor profiles, MAARG-style ranked matching, requests, session log (new)
    actions.ts          Server Actions — every mutation in the app
    auth.ts             NextAuth config
    realEvidence.ts     the real, cited reference data
prisma/
  schema.prisma         data model DESIGN DOCUMENT (not executable — see D-007)
  migrations/001_init.sql  the actual executable schema
scripts/
  migrate.ts                    applies prisma/migrations/*.sql
  migrate-sqlite-to-postgres.ts one-time data preservation from the old SQLite build
docs/
  DECISION_LOG.md       every architectural decision made building the institutional layer
  ROADMAP.md            Implemented / Partial / Planned / Deferred status of the full spec
tests/
  rbac.test.ts          cross-tenant and cross-role access-denial tests (npm test)
  mentorship.test.ts    mentor-request/session access-control tests (npm test)
```

## Honesty notes carried over from the design brief

- No TAM/SAM/SOM is invented for a specific venture — the Evidence page explicitly says so and
  shows what real research would be needed instead.
- One market-size figure found during research was excluded rather than shown, because it was
  implausible (a likely publisher data error) — see the note on the Evidence page.
- The Venture Readiness score always shows its components, weights, and *why* each one scored
  what it did.
