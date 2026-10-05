# Deployment (D-018, docs/DECISION_LOG.md)

This file is referenced from `.env.example` and several test files
(`tests/*.test.ts` say "requires DATABASE_URL — see docs/DEPLOYMENT.md")
but didn't actually exist until D-018 — a real gap, closed here rather
than left silently broken.

## Local development / running the test suite

```bash
# Postgres 16, running locally (or any reachable Postgres 16 instance)
export DATABASE_URL="postgresql://zcubs:zcubs_dev_local_pw@localhost:5432/zcubs_dev"
npm run db:migrate
npm run dev            # http://localhost:3000
# or, to run the test suite:
npm test
```

`NEXTAUTH_SECRET` and `NEXTAUTH_URL` are also required for login to work —
see `.env.example`, copy it to `.env.local` and fill in real values. Every
AI-assisted feature (`ANTHROPIC_API_KEY`) is optional and fails soft to a
deterministic non-AI fallback when unset (D-011).

## Recommended free-tier deployment

Two real, currently-free services, used together because neither one's
free tier alone is a good fit for the whole stack:

| Piece | Service | Why |
|---|---|---|
| Postgres | [Neon](https://neon.com) Free plan | Persistent — no expiry. 0.5 GB storage/project, 100 CU-hours/month compute, no credit card required. |
| Next.js app | [Render](https://render.com) Free web service | 512 MB RAM / 0.1 CPU, spins down after 15 minutes with no traffic (~1 minute cold start on the next request), 750 free instance-hours/month per workspace. |

Render also offers a free Postgres tier, but it **expires after 30 days**
— fine for a demo, not for real data — which is why Neon is used for the
database instead. (Both sets of numbers were verified against Render's and
Neon's own pricing/docs pages while building this decision — provider free
tiers change over time, so re-check before relying on them for anything
important.)

### Steps

1. **Create the database.** Sign up at neon.com (free, no card), create a
   project, and copy the connection string it gives you — that's your
   `DATABASE_URL`.
2. **Run migrations against it once, from your own machine**, before the
   app's first deploy:
   ```bash
   DATABASE_URL="<your neon connection string>" npm run db:migrate
   ```
3. **Deploy the app to Render** using the included `render.yaml` Blueprint
   (Render dashboard → New → Blueprint → point it at this repo). Render
   reads `render.yaml` and creates the web service automatically. In the
   Render dashboard, set the two secrets the blueprint leaves blank:
   - `DATABASE_URL` — the Neon connection string from step 1.
   - `NEXTAUTH_URL` — your real Render URL
     (`https://<your-service-name>.onrender.com`), set after the first
     deploy once you know the URL.
   `NEXTAUTH_SECRET` is generated for you by Render (`generateValue: true`
   in the blueprint) — never hand-typed or committed anywhere.
4. **Optional:** set `ANTHROPIC_API_KEY` in the Render dashboard if you
   want AI-assisted suggestions/drafting turned on. Leave it unset and
   those features keep working via their deterministic fallback (D-011).

`render.yaml`'s `buildCommand` runs `npm run db:migrate` as part of every
build, so schema changes ship automatically on the next deploy — real
migrations against your real Neon database, not a separate manual step to
remember. (This does mean two concurrent builds could race on migrations;
for a single free web service with no preview-environment builds, that's
not a real risk here — a team running multiple environments off this same
blueprint should split migration out into its own step.)

### What this deployment path does NOT give you

Being direct about the limits of a free-tier setup, not just its cost:

- **Cold starts.** The first request after 15 minutes of silence waits
  ~1 minute for the free web service to spin back up. Fine for a
  demo/pilot; not acceptable for a production launch with real users who
  won't wait — that's a paid Render instance type (or another host)
  concurrent with actual usage.
- **No autoscaling.** One instance, 0.1 CPU, 512 MB RAM. This is a demo/
  small-pilot deployment, not infrastructure sized for the "1,000+
  institutions" scale referenced elsewhere in this project's roadmap.
- **No staging environment automation.** One Blueprint, one environment.
  A real staging/production split is a real follow-up, not set up here.
- **Neon's compute-hours cap.** 100 CU-hours/month on the free plan; past
  that, Neon suspends compute until the next billing month (data isn't
  lost, just inaccessible until then). Worth monitoring once there's real
  traffic.

## Backups (D-018)

`scripts/backup/backup.sh` runs a real `pg_dump` against `DATABASE_URL`,
gzips it, and uploads it to an S3-compatible bucket (tested against
[Cloudflare R2](https://developers.cloudflare.com/r2/) — 10 GB free
storage, no egress fees, no credit card required for the free tier at time
of writing). `.github/workflows/backup.yml` runs it daily via GitHub
Actions' own free-tier runners — no paid backup vendor.

### One-time setup

1. Create a Cloudflare account, enable R2, create a bucket, and create an
   R2 API token (Account → R2 → Manage API tokens) scoped to that bucket.
2. In this repo's GitHub Settings → Secrets and variables → Actions, add:
   - `DATABASE_URL` — same Neon connection string as above.
   - `BACKUP_S3_ENDPOINT` — your R2 account's S3-compatible endpoint
     (Cloudflare shows this next to your account ID, of the form
     `https://<account-id>.r2.cloudflarestorage.com`).
   - `BACKUP_S3_BUCKET` — the bucket name.
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — the R2 API token's
     access key ID / secret (R2 uses the S3 API, so the AWS CLI's
     credential variable names work unchanged).

Without those secrets set, `.github/workflows/backup.yml` still runs
`pg_dump` inside the ephemeral runner and prints that it made a real dump
but skipped uploading it — never a fabricated "backup succeeded" message
for an upload that didn't happen.

### Running a backup manually

```bash
DATABASE_URL="..." \
BACKUP_S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com" \
BACKUP_S3_BUCKET="zcubs-backups" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
  bash scripts/backup/backup.sh
```

### Restoring

`scripts/backup/restore.sh` is the companion script — it OVERWRITES the
target database and, consistent with this project's rule that destructive
actions are never auto-run (see D-010's human-reviewed data-deletion
flow), refuses to run without an explicit `--yes-i-am-sure` flag and
always prints exactly which database it's about to overwrite first:

```bash
DATABASE_URL="<target db>" bash scripts/backup/restore.sh path/to/dump.sql.gz --yes-i-am-sure
```

Both scripts were run end-to-end against a real local Postgres database as
part of building this decision (see D-018 in `docs/DECISION_LOG.md` for
the verification details) — not just written and assumed to work.

## Razorpay plan-purchase checkout (D-020)

Payments are entirely optional and off by default. `RAZORPAY_ENABLED` in
`src/lib/payments.ts` is `true` only once `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are all set — until
then the pricing page shows no "pay" buttons and `/api/payments/*` return
503.

1. **Get API keys.** In the Razorpay Dashboard, go to Settings > API Keys
   and generate a Key ID/Secret pair. Use Test Mode keys until you're
   ready to accept real payments — Razorpay's test mode uses the same API
   shape, so nothing in this app changes when you switch to live keys.
2. **Set the key env vars** — `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
   from step 1.
3. **Create the webhook.** In the Dashboard, go to Settings > Webhooks >
   Add New Webhook. Set the URL to `https://<your-domain>/api/payments/webhook`,
   pick a webhook secret (any strong random string — this is not an API
   key, you invent it), and subscribe to at least the `payment.captured`
   and `payment.failed` events. Set `RAZORPAY_WEBHOOK_SECRET` to the same
   secret you entered in the Dashboard — this is what lets
   `src/app/api/payments/webhook/route.ts` verify a request genuinely
   came from Razorpay (HMAC-SHA256 over the raw request body).
4. **Set a price per plan you want self-serve**, in whole INR, via
   `RAZORPAY_PRICE_INR_<PLAN_CODE>` (see `.env.example` for the exact
   variable names). A plan with no price set is treated as a negotiated
   sale, not self-serve — this project deliberately never invents a
   price. `institution` and `enterprise_government` are expected to stay
   unpriced for this reason.
5. **Test it.** With test-mode keys, use Razorpay's published test card/UPI
   numbers to run a real checkout end-to-end on a deployed instance (the
   webhook needs a public HTTPS URL — it cannot reach `localhost`), and
   confirm the user's plan updates within a few seconds of payment.

**Architecture, in one paragraph:** the client-side Razorpay Checkout
success callback is never trusted to grant a plan upgrade — a compromised
or lying browser could otherwise self-grant any plan for free. Only the
signature-verified webhook (`payment.captured`/`payment.failed`) calls
`setUserPlan`, and that handler is idempotent — a retried webhook delivery
for an already-processed payment is a safe no-op, never a double credit.
See D-020 in `docs/DECISION_LOG.md` for the full design and exactly what
was and wasn't verified against Razorpay's real API in this session.

## What was deliberately NOT done

- No staging/production split, no blue-green or zero-downtime deploys —
  out of scope for a first free-tier deployment path.
- No automated backup-restore drill (a scheduled job that restores the
  latest backup into a scratch database and verifies it) — the restore
  path was verified manually once while building this decision; a
  recurring automated drill is a real follow-up, not built here.
- No alerting when a scheduled backup fails — GitHub Actions will show a
  failed workflow run in the repo's Actions tab, but nothing pages anyone.
