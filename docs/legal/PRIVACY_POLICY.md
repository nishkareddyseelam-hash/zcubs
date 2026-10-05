# Z Cubs — Privacy Policy (DRAFT)

> **This is a first draft, not a finished legal document.** Like
> `docs/legal/TERMS_OF_SERVICE.md`, it describes what Z Cubs actually
> stores and does, traced to the real features in `docs/DECISION_LOG.md`
> — it is not legal advice, has not been reviewed by a lawyer, and must
> not be published until a licensed lawyer has reviewed it. See "What
> still needs a lawyer" at the end.

## What we collect

**Account information:** name, email, password (hashed, never stored in
plain text), and account type (Explorer/Founder/Institution admin) at
signup.

**What you put into the product:** your Self Discovery answers,
Opportunity Cards, Validation Lab experiments (including the risk flags
you self-declare — see below), Evidence Passport entries, Guide progress,
mentor profile (if you create one), and messages sent through the mentor
request/session system.

**Institutional data**, if you're enrolled through an institution: your
cohort/programme/institution membership, application answers if you
applied through a programme, and evaluation records if you're evaluated
(visible to the evaluator and your programme's managers, not to other
founders).

**Guardian relationship records**, for Explorer (13-17) accounts: a
guardian's name and email, and a timestamped record of when a consent
link was confirmed (see "Guardian consent" below) — see D-010 in the
decision log for the actual schema.

**Usage records:** an append-only consent-decision trail (what you
consented to and when), an audit log of institutional actions (who did
what, when — for accountability on shared/institutional data, not
individual tracking of founders using their own tools), and — if AI
features are enabled on this deployment — a count of AI calls made per
day, for quota enforcement (D-011). AI usage counts are stored as a
count, not the content of what was asked, beyond what's needed to enforce
the daily limit.

**Payment records:** if you buy a plan on a deployment with Razorpay
configured (D-020), we keep a record of the purchase itself — which plan,
the amount, and Razorpay's own order/payment IDs — so your plan can be
upgraded and so you have a record of what you paid for. We do not see or
store your card, UPI, or bank details at all; those go directly to
Razorpay, never through Z Cubs' own servers.

**What we do NOT collect:** your actual card, UPI, or bank account
numbers (Razorpay handles those directly — see "Payment records," above),
government ID numbers, or any data from a mentor's optional reference
contact beyond what that mentor typed in (that reference is never
contacted by Z Cubs).

## How we use it

To provide the Service back to you: render your dashboard, compute your
readiness/evidence indicators from your own real data (never a fabricated
or estimated figure — see `docs/ROADMAP.md`, "Never simulated, by
design"), match you with mentors based on your own stated categories and
their own stated capacity, and give your institution (if you're enrolled
through one) real, computed cohort-health and mentor-coverage figures.

We do not sell your data. We do not use your content to train external AI
models. If AI-assisted features are enabled on this deployment, your
prompt is sent to the configured AI provider to generate a draft
response for you — see D-011 in the decision log for the technical
detail, and the AI provider's own privacy terms for how they handle that
request (this document doesn't attempt to describe a third party's
policy; whoever operates this deployment should link the actual
provider's terms here).

**Insight library (D-021) — entirely opt-in, on a feature-by-feature
basis.** Some pages let you explicitly choose to share one specific piece
of your own work (for example, an Opportunity Card) to help the AI guide
other founders. This is never automatic and never assumed by using the
Service — it only happens when you click a clearly labelled "share"
action for that specific item. What sharing actually does: your
submission goes into a private review queue that only a Z Cubs
administrator can see; nothing is used until a human reads it, removes
anything identifying, and approves a rewritten version. Only that
rewritten, anonymized version is ever used — as reference material spliced
into the AI's instructions for other founders' drafts, the same "sent to
the AI provider to generate a draft" flow described above, never as
training data for the underlying model, and never shown to another
founder as something you personally said. If you're on an Explorer (13-17)
account, this requires a confirmed guardian relationship first, the same
requirement D-012 already places on other real-world data-sharing
decisions.

## Your rights — real, working features, not just policy language

`/dashboard/privacy` in the product itself lets you:

- **See your consent history** — every consent decision you've made, with
  a timestamp, in an append-only record.
- **Download your data** — a real, live export of every row you own
  across the product's tables, generated on demand.
- **Request deletion** — filed as a request, reviewed by a human, and
  executed as a separate explicit action (never automatic) — see D-010 in
  the decision log for why: an irreversible action like account deletion
  is treated with the same care this product applies to every other
  destructive action (see also the backup/restore tooling in
  `docs/DEPLOYMENT.md`, which requires an explicit confirmation flag for
  the same reason).

**Open question for legal review:** what turnaround-time commitment (if
any) to state for a deletion request, and what specific data-subject
rights language is required to satisfy the jurisdictions this deployment
actually serves.

## Guardian consent (Explorer / 13-17 accounts)

An Explorer account's guardian is invited via a link. "Confirmed" means
that link was opened and confirmed by whoever received it — this is a
double opt-in flow (the same bar most consumer email-confirmation flows
use), **not an identity-verified guardianship check.** See Section 6 of
`docs/legal/TERMS_OF_SERVICE.md` for exactly which actions this consent
gates, and D-012 in the decision log for the reasoning behind that scope.

**Open question for legal review:** whether this consent-confirmation
mechanism is sufficient for the jurisdictions this deployment serves, and
what a compliant Privacy Policy needs to additionally disclose about
data collected from a 13-17 year old before a guardian relationship is
even established (the core learning features are usable before any
guardian is invited — see Section 6 of the Terms of Service).

## Mentors and the data they see

If you send a mentor request, the mentor you message can see your
message, your stated categories/missions used for matching, and whatever
you write in session logs together. A mentor profile is self-declared and
not background-checked (see Section 5 of the Terms of Service) — treat
what you share with a mentor accordingly.

## Institutional facilitators and the data they see

An institution can designate its own staff as facilitators, who run a
cohort's weekly sessions themselves instead of (or alongside) an outside
mentor. A facilitator can see the real per-week programme guidance for
the programmes they facilitate, and logs a short summary and headcount
for each session they run — visible to that institution's own staff, the
same way mentor session logs are visible to the founder and mentor who
wrote them. A facilitator is an existing institution member designated by
that institution's own staff (see Section 7 of the Terms of Service) —
Z Cubs performs no separate vetting of who an institution chooses.

## Data retention and deletion

Data is retained until you request deletion (see "Your rights," above) or
— for institutional data — per whatever retention note an institution
sets for its programme (a real field in the schema; institutions have not
yet been required to set a specific retention period as of this draft —
see D-004/D-006 in the decision log).

**Open question for legal review:** a default retention period, and
what happens to an institution's cohort data when a founder's own account
is deleted but the institution's audit/evaluation records reference them,
are both open design questions this draft does not resolve.

## Children's data (Explorer / 13-17 accounts)

See "Guardian consent," above, for what consent model is currently
implemented. This draft does not claim compliance with any specific
children's-data law (e.g. COPPA in the US, DPDP Act 2023's provisions for
data of a person below 18 in India) — that determination, and any
additional disclosures or consent-timing changes it requires, is squarely
a question for the lawyer reviewing this draft.

## What still needs a lawyer

1. Turnaround-time commitments for data export/deletion requests.
2. Whether the guardian double-opt-in model satisfies applicable
   children's-data law, and what additional disclosure it requires.
3. A specific retention-period policy (currently: "until you ask,"
   informally).
4. Confirmation of which AI provider (if any) is actually used in a real
   deployment, and linking that provider's own privacy terms here.
5. Jurisdiction-specific data-subject-rights language (this draft is
   written generally, informed by DPDP Act 2023 as a reference point per
   D-010, but is not a certified compliance document for any specific
   law).
