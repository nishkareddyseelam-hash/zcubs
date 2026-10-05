// Curated, always-available option lists for each intake-form field. These
// are the fallback (and starter) suggestions shown before/without a live AI
// call — realistic, India/Gen-Z-relevant option lists, not claims about any
// real venture's data, so they don't fall under the evidence-governance
// no-fabrication rule (which governs claims about the user's OWN venture).
//
// Keyed as "<page>.<field>" to keep unrelated fields from colliding.
export const CURATED_SUGGESTIONS: Record<string, string[]> = {
  "fitmap.strengths": [
    "Structured problem-solving",
    "Comfortable selling face-to-face",
    "Strong network / community connections",
    "Design and visual sense",
    "Persistent — doesn't give up easily",
    "Comfortable with numbers and budgeting",
    "Good at explaining things simply",
    "Fast learner — picks up new tools quickly",
    "Organized and detail-oriented",
    "Resourceful — gets things done with limited resources",
  ],
  "fitmap.develop": [
    "Financial modelling",
    "Public speaking / pitching",
    "Sales and negotiation",
    "Technical / coding skills",
    "Design and branding",
    "Legal and compliance basics",
    "Hiring and delegation",
    "Data analysis",
    "Marketing and growth",
    "Operations and logistics",
  ],
  "fitmap.time": [
    "5 hrs/week alongside college",
    "10 hrs/week alongside college",
    "15–20 hrs/week, part-time",
    "20–30 hrs/week, mostly full-time",
    "40+ hrs/week, fully full-time",
    "Weekends only for now",
  ],
  "fitmap.capital": [
    "₹0 — bootstrapped, no capital yet",
    "₹0–₹25,000 personal savings",
    "₹25,000–₹1,00,000 personal savings",
    "₹1,00,000–₹5,00,000 from family/friends",
    "₹5,00,000+ raised or committed",
    "Applying for a grant or competition prize",
  ],
  "opportunities.customer": [
    "College students in my city",
    "First-generation college students",
    "Gig-economy workers",
    "Small local retailers/kirana stores",
    "Working parents in tier-2 cities",
    "Freelancers and independent creators",
    "Small business owners (MSMEs)",
    "Recent graduates job-hunting",
  ],
  "opportunities.mission": [
    "Interview 10 potential customers about this problem",
    "Run a landing page and measure signups",
    "Build a manual/concierge version and test with 5 users",
    "Survey a relevant online community",
    "Pre-sell to 5 people before building anything",
    "Shadow a target customer for a day",
  ],
  "validation.method": [
    "1:1 customer interviews",
    "Landing page + signup conversion test",
    "Concierge MVP (do it manually first)",
    "Online survey",
    "Pre-sale / letter of intent",
    "A/B test of pricing or messaging",
    "Pilot with a small cohort",
  ],
  "validation.kpi": [
    "% of interviewees who confirm the problem unprompted",
    "Landing page signup conversion rate",
    "Number of pre-orders or letters of intent",
    "Willingness to pay (₹ amount stated)",
    "Repeat usage rate in the pilot",
    "Net Promoter Score from pilot users",
  ],
  "validation.threshold": [
    "≥50% confirm the problem = proceed, <20% = stop",
    "≥10% signup conversion = proceed",
    "≥5 pre-orders in 2 weeks = proceed",
    "≥70% pilot users would pay = proceed",
    "≥3 repeat uses per user in pilot = proceed",
  ],
  "validation.name": [
    "Customer interview sprint",
    "Landing page signup test",
    "Concierge MVP pilot",
    "Pricing willingness-to-pay survey",
    "Pre-sale / letter-of-intent push",
    "Community demand check",
  ],
  "validation.hypothesis": [
    "Target customers will confirm this problem unprompted in a conversation",
    "At least 10% of landing-page visitors will sign up with just an email",
    "A manually-delivered version of this will get repeat use from early users",
    "Customers will state a specific price they'd pay for this",
    "At least 5 people will pre-commit before the product exists",
  ],
  // Suggested CLAIMS TO GO VERIFY for the Evidence Register — these are
  // research starting points, never fabricated facts. Every one still needs
  // a real source, metric and publisher filled in before it counts as
  // evidence; the UI says so next to the field.
  "evidence.claim": [
    "How many people in the target customer segment actually experience this problem",
    "What target customers currently do instead (existing workaround or competitor)",
    "What target customers say they'd be willing to pay for a solution",
    "How large and active the relevant online community/segment actually is",
    "Whether a regulatory or compliance requirement applies to this idea in India",
    "What a comparable business's real reported traction or funding actually is",
  ],
};

export function getCuratedSuggestions(field: string): string[] {
  return CURATED_SUGGESTIONS[field] ?? [];
}

/** Fallback idea seeds for /api/generate-idea when no AI key is configured —
 * generic, non-venture-specific templates a founder edits, never presented
 * as researched or personalized. Each carries a stable `id` so a home-page
 * "ready to click" template tile can request that exact pattern instead of
 * a random one. */
export const CURATED_IDEA_SEEDS: { id: string; label: string; title: string; customer: string; problem: string; mission: string }[] = [
  {
    id: "marketplace",
    label: "Peer marketplace",
    title: "Verified peer marketplace for [category]",
    customer: "College students in my city",
    problem: "Hypothesis: students waste time and money because there's no trusted way to find/verify [category] within their own campus network.",
    mission: "Interview 10 students about how they currently handle this — do they confirm the problem unprompted?",
  },
  {
    id: "concierge",
    label: "Concierge service",
    title: "Concierge service for [task] for busy professionals",
    customer: "Working professionals in tier-2 cities",
    problem: "Hypothesis: busy professionals would pay someone else to handle [task], but no locally-trusted option exists yet.",
    mission: "Run a landing page describing the service and measure signup interest before building anything.",
  },
  {
    id: "subscription",
    label: "Subscription box",
    title: "Subscription box/service for [niche] enthusiasts",
    customer: "Gen Z hobbyists / niche community members",
    problem: "Hypothesis: this community currently has to piece together [niche] needs from multiple unreliable sources.",
    mission: "Survey a relevant online community and see how many say they'd subscribe.",
  },
  {
    id: "b2b-tool",
    label: "B2B tool for MSMEs",
    title: "B2B tool for small [sector] businesses",
    customer: "Small business owners (MSMEs) in [sector]",
    problem: "Hypothesis: small [sector] businesses lose time/money on a manual process that could be simplified.",
    mission: "Shadow or interview 5 small business owners in this sector about their current workflow.",
  },
];
