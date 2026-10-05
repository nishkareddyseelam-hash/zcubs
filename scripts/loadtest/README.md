# Load testing (D-017)

Three [k6](https://k6.io) scripts, each targeting a real, unmodified part of
the app — no mocks, no fixture accounts, no stubbed auth. k6 is not an npm
package; install it separately (`brew install k6`, or see
[k6.io/docs/get-started/installation](https://k6.io/docs/get-started/installation)
— it's free and open-source, no paid load-testing vendor needed).

## What's here

- `smoke.js` — unauthenticated: home, login, signup pages. Fast baseline
  check that the app is up and public pages render under light concurrency.
- `founder-journey.js` — each virtual user signs up a real account, logs
  in through the real NextAuth flow, and reads the pages a founder visits
  most (dashboard, Opportunity Cards, Validation Lab, Mentors, Evidence
  Passport, Guide).
- `institution-dashboard.js` — same pattern against `/dashboard/institution`,
  the heaviest page in the app.
- `lib.js` — shared helpers (`signUpAndLogIn`, `get`) used by the above.
  Not a runnable test on its own.

## Honest scope — what this does NOT cover

These scripts load-test **page reads**, not the write actions inside those
pages (adding an Opportunity Card, submitting an experiment, creating a
programme, etc.). Every write in this app goes through a Next.js Server
Action, which is invoked over a wire protocol keyed to a build-specific
action id — not something that can be scripted reliably from outside the
running app. The write paths already have real automated coverage in
`tests/*.test.ts` (43 tests as of D-016), exercising the exact same
service-layer functions the UI calls; what unit tests don't measure is
concurrent read throughput and latency under load, which is what these
scripts are for. If real write-path load testing is needed later, the
honest way to get it is a small number of dedicated test-only API routes
that call the same `src/lib/*.ts` functions the Server Actions call — not
attempted here, since that would mean shipping test-only endpoints in the
production app.

## Running

Every run creates real user accounts through the real signup endpoint.
**Run these against a disposable/local database, never a real production
database** — the same rule that applies to every script in this repo. The
simplest setup is the same local Postgres this project's own tests use:

```bash
export DATABASE_URL="postgresql://zcubs:zcubs_dev_local_pw@localhost:5432/zcubs_dev"
npm run build && npm start &          # or: npm run dev
export BASE_URL="http://localhost:3000"

k6 run scripts/loadtest/smoke.js
k6 run scripts/loadtest/founder-journey.js
k6 run scripts/loadtest/institution-dashboard.js
```

Each script accepts `BASE_URL` (default `http://localhost:3000`) as an
environment variable, so the same scripts point at a real staging
deployment by changing one variable — with the same accounts-get-created
caveat above.

## Reading the output

k6 prints a summary at the end of each run: request counts, failure rate,
and latency percentiles (p50/p90/p95). Each script sets `thresholds` — k6
exits non-zero if a threshold is breached, so these can be wired into CI
later as a pass/fail gate (not done in `.github/workflows/ci.yml` yet — see
docs/ROADMAP.md; a load test needs a running server and takes minutes, a
different shape of job than the existing fast unit-test/lint/build CI run).

## Cleaning up test accounts

Every run leaves real rows in `users` (and whatever they touch) with
`@loadtest.example.com` addresses. Against a disposable database this
doesn't matter; if reused, clean up with:

```sql
DELETE FROM users WHERE email LIKE '%@loadtest.example.com';
```

(Some rows may be skipped by a foreign-key constraint from `audit_events`
— the same harmless leftover-test-account behavior already documented for
this project's Playwright verification runs; it doesn't affect anything
else.)
