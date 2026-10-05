# Z Cubs — Terms of Service (DRAFT)

> **This is a first draft, not a finished legal document.** It was written
> to accurately describe what Z Cubs actually does today, based on the
> real, built features documented in `docs/DECISION_LOG.md` — it is not
> legal advice, has not been reviewed by a lawyer, and must not be
> published or relied on until a licensed lawyer (ideally one familiar
> with Indian consumer-protection and minors'-data law) has reviewed it.
> Claude is not a lawyer and this draft should not be treated as a
> substitute for one. See "What still needs a lawyer" at the end of this
> document for the specific open questions this draft could not resolve
> on its own.

**Last drafted:** see the date of the commit that introduced this file.
**Applies to:** the Z Cubs website and app (the "Service"), operated as
described in `docs/DECISION_LOG.md` and `docs/ROADMAP.md`.

## 1. What Z Cubs is

Z Cubs is an educational and mentorship platform for young people (13+)
exploring entrepreneurship. It provides structured self-discovery
exercises, opportunity evaluation tools, an evidence-tracking workspace, a
guided venture-building curriculum, and a mentor-matching system.

**Z Cubs provides business education and decision support. It does not
guarantee financial returns, business success, funding, legal compliance,
or investor acceptance.** (This sentence already appears verbatim in the
product's own footer — this draft is written to match what the product
actually says, not to introduce new claims.)

Z Cubs does **not**: incorporate businesses on your behalf, process
payments or investments, provide legal or tax advice, guarantee mentor
availability or quality beyond what mentors self-declare (see Section 5),
or connect to any government approval, ranking, or certification system.
Nothing on the Service should be read as implying any of those things —
see `docs/ROADMAP.md`'s "Never simulated, by design" section for the
product's own internal list of claims it deliberately never makes.

## 2. Accounts and eligibility

Z Cubs offers three account types at signup:

- **Explorer (13–17)** — for young people still in school. See Section 6
  for the additional guardian-related terms that apply to this account
  type.
- **Founder (18+)** — for adults building a venture independently.
- **Institution admin** — for a staff member at a school, university, or
  incubation program setting up a programme on behalf of that institution.

You must provide accurate information when creating an account. You are
responsible for keeping your password confidential and for all activity
under your account.

**Open question for legal review:** the Service currently accepts
signups starting at 13 with no stated upper or lower bound enforced
beyond the "Explorer"/"Founder" split at 18, and no institution-side
approval gate before an Explorer can create their own account (guardian
consent is requested and enforced only for two specific actions — see
Section 6, D-012 in the decision log — not for signup itself, per an
explicit, considered product decision). Whether that account-creation
model is sufficient, or needs a stronger age-gate or verified-institution
sponsorship requirement, is a legal/policy question this draft does not
resolve.

## 3. Your content and data

You own the content you create in Z Cubs (opportunity cards, experiments,
evidence, guide entries, mentor profile). Z Cubs stores it to provide the
Service back to you and does not sell it, and does not use it to train
external AI models beyond what's described in Section 4.

You can see and control what's stored about you, in real terms — not a
promise, a working feature: `/dashboard/privacy` (see D-010 in the
decision log) lets you review your consent history, download a real
export of your data across every table you own rows in, and request
deletion. Deletion requests are reviewed by a human before being executed
— they are not instant, and this draft cannot promise a specific turnaround
time until that's set by whoever operates the Service.

**Open question for legal review:** this Service is built with a data
model shaped by India's Digital Personal Data Protection Act, 2023, as
its reference point (see D-010) — but that is a description of the
schema's design intent, not a compliance certification. Whether the
Service is actually DPDP-compliant, what a formal Privacy Policy needs to
say to satisfy it, and what obligations apply once real user data is
collected at scale are all questions for the lawyer reviewing this draft,
not something this document can certify.

## 4. AI-assisted features

Some features (idea suggestions, draft mentor replies, Guide content
drafting) can optionally use an AI model to help generate a starting
draft for you to edit. This is off by default in any deployment where no
AI provider key is configured, and every AI call site has a non-AI
fallback that still works when it's off (see D-011 in the decision log).
When AI features are enabled, usage is subject to a daily quota — this is
a technical/cost safeguard, not a legal term, but is disclosed here for
completeness. AI-generated content is a draft for you to review and edit,
never a final answer presented as fact — see Section 1's evidence-quality
commitments.

## 5. Mentors

Anyone with an account can offer to mentor. A mentor profile requires a
real, non-empty description of what qualifies that person to mentor and
an explicit attestation checkbox — but **Z Cubs does not perform a
background check, reference check, or identity verification of mentors.**
Every mentor match card is labelled "Self-declared, not verified by Z
Cubs" for exactly this reason (see D-013 in the decision log). If a
mentor also provides an optional reference contact, Z Cubs does not
contact that reference itself.

**Open question for legal review:** what liability language is
appropriate given mentors are unvetted adults who may be matched with a
13-17 year old Explorer account (mitigated on the product side by the
guardian-consent gate in Section 6, but that is a product safeguard, not
a legal indemnification — the lawyer reviewing this draft should decide
what disclaimer/liability language belongs here).

## 6. Explorer (13–17) accounts and guardian involvement

Z Cubs does not require guardian consent to create an Explorer account or
to use the core learning features (Self Discovery, Opportunity Cards,
Evidence Lab, Guide). Guardian consent **is** required, and enforced by
the Service itself, before an Explorer account can:

- save a Validation Lab experiment that the founder has self-declared
  involves real money, a contract, or contacting someone they don't
  already know, or
- send a message to a mentor (an unvetted adult — see Section 5).

This scope was a deliberate product decision, made after a documented
back-and-forth about what a guardian-consent requirement should actually
gate on an educational platform that doesn't itself hold real money or
incorporate ventures (see D-012 in the decision log for the full
reasoning). A guardian relationship is "confirmed" when a guardian opens
a link sent to them and confirms it — this is a double opt-in flow, not
an identity-verified guardianship check.

**Open question for legal review:** whether this scoped consent model
satisfies applicable law for the jurisdictions the Service will actually
operate in, and what the Privacy Policy needs to disclose about it, is
for the lawyer reviewing this draft to determine.

## 7. Institutions and programmes

An institution admin can register an institution, build a programme, open
cohorts, and run applications through to enrolment. No institution is
labelled "government approved," "IIC compliant," or similarly certified
by Z Cubs without an actual verified record — the product does not
fabricate or imply institutional accreditation it hasn't confirmed (see
`docs/ROADMAP.md`, "Never simulated, by design").

An institution's own staff (owner, administrator, or programme manager)
can designate an existing member of that institution as a facilitator,
who can then run a cohort's sessions themselves. Z Cubs performs no
separate vetting of who an institution designates — that judgment call is
the institution's, the same way mentor self-attestation (Section 5) is
the mentor's own.

## 8. Payment and plans

Z Cubs currently has no connected payment processor. Every account
defaults to the free plan; any other plan is set manually by an
administrator, never through a self-serve "Upgrade" checkout (see D-011
in the decision log). **This draft intentionally does not include billing
terms, refund policy, or subscription-cancellation language, because no
paid purchase flow exists yet to write terms for.** Those terms need to
be added — and reviewed by a lawyer — before any real payment flow ships.

## 9. Termination

You may stop using the Service and request deletion of your account and
data at any time via `/dashboard/privacy`.

**Open question for legal review:** grounds and process for Z Cubs
terminating an account (e.g. for abuse, for a safety concern involving an
Explorer account) are not yet specified in this draft — a real incident-
response and account-termination policy is a separate piece of work this
draft does not attempt.

## 10. Limitation of liability, warranty disclaimers, governing law, dispute resolution

**Not drafted here.** These are exactly the sections where boilerplate
language, copied without legal judgment, could either fail to protect the
Service's operator or make promises they can't keep. This draft
deliberately leaves them blank rather than filling them with generic
template language, so a lawyer starts from a clean, honest slate rather
than having to first find and remove language that shouldn't have been
there.

## What still needs a lawyer

This draft was written from the real, built product, not invented — every
factual claim in it traces to a decision documented in
`docs/DECISION_LOG.md`. But it is missing, by design, the parts that
require actual legal judgment rather than an accurate description of the
product:

1. Section 10 in full (liability, warranties, governing law, disputes).
2. Whether the account-creation and guardian-consent model in Sections 2
   and 6 meets applicable legal requirements for minors.
3. Whether the data-handling described in Section 3 needs stronger DPDP
   Act 2023 compliance language, and what specifically that requires.
4. Liability language for the mentor-matching model in Section 5.
5. Termination/incident-response process for Section 9.
6. Billing terms, once (and only once) a real payment flow exists — see
   Section 8.
7. Jurisdiction/governing-law selection, and whether a separate
   arbitration or dispute-resolution clause is needed.
