// A guided, step-by-step business-planning journey — in the spirit of
// IdeaBuddy's "Guide" (four chapters, ~5 steps each, a narrative field per
// step plus item-list builders and a notes box), adapted to Z Cubs' own
// evidence-governance rule: nothing here is presented as a researched fact.
// Wherever Z Cubs already has real data for a topic (Trend Radar for
// sectors, Rival Radar for comparables, India Ledger/DPR for startup costs
// and financing, Money Lab for revenue/cost drivers), the step *links* to
// that real page instead of re-asking for and duplicating the same numbers.
// Every field/item entered here is either the founder's own input or an
// explicitly AI-drafted, "review and edit" hypothesis — never a fabricated
// specific fact, statistic, or invented company.

export type GuideFieldDef = { key: string; label: string; hint: string; ai?: boolean; kind?: "textarea" | "select"; options?: string[]; rows?: number };
export type GuideItemFieldDef = { key: string; label: string; type: "text" | "textarea" | "number" | "select"; options?: string[]; placeholder?: string };
/** Declarative (not a function — this schema crosses the server→client
 * component boundary as a prop, so it must stay plain-data-serializable)
 * description of a computed total across a list's numeric fields: "sum" adds
 * one field across all items, "sumProduct" multiplies two fields per item
 * then sums (e.g. headcount × monthly salary). warnIfNot flags a total that
 * should equal a specific number (e.g. equity summing to 100%) without
 * blocking saving — it's the founder's own numbers, just surfaced honestly. */
export type GuideItemTotal = { label: string; fieldKeys: string[]; op: "sum" | "sumProduct"; format: "currency" | "percent" | "number"; warnIfNot?: number };
/** Per-item priority badge — averages the item's own 1-5 fields (e.g.
 * segment size, willingness to pay, accessibility) into a High/Medium/Low
 * label. Purely arithmetic on the founder's own entered numbers, same
 * governance guardrail as the list-level total: never an invented score. */
export type GuideItemPriority = { fieldKeys: string[] };
export type GuideItemSchema = { listKey: string; label: string; addLabel: string; itemLabelKey: string; fields: GuideItemFieldDef[]; total?: GuideItemTotal; priority?: GuideItemPriority };
export type GuideLinkedPage = { label: string; href: string; note: string };

export type GuideStep = {
  id: string;
  chapterId: string;
  title: string;
  tagline: string;
  welcome: string; // shown in the dismissible info panel, like IdeaBuddy's "Welcome to the X section"
  fields: GuideFieldDef[];
  itemSchema?: GuideItemSchema;
  swot?: boolean; // special-cased 4-quadrant layout
  linked?: GuideLinkedPage[];
};

export type GuideChapter = { id: string; title: string; tagline: string; steps: GuideStep[] };

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: "concept",
    title: "Concept",
    tagline: "Define your value proposition, develop marketing and sales strategies, and identify key partners.",
    steps: [
      {
        id: "idea",
        chapterId: "concept",
        title: "Idea",
        tagline: "Outline your idea in a nutshell, explain the problem you solve, why it matters, and what makes your solution unique.",
        welcome: "This is the starting point for bringing your business idea to life. Start by sharing the story behind your idea as an executive summary, then name the problem it solves and what makes your solution different. Use the Notes box at the bottom for anything extra.",
        fields: [
          { key: "summary", label: "Executive summary", hint: "Write a brief overview of your business idea", ai: true, rows: 6 },
          { key: "problem", label: "Market problem", hint: "Describe the problem your idea addresses", ai: true, rows: 3 },
          { key: "solution", label: "Your solution", hint: "Explain what makes your solution different", ai: true, rows: 3 },
        ],
        linked: [{ label: "Opportunity Forest", href: "/dashboard/opportunities", note: "Your saved Opportunity Card(s) — the founder-observed problem, customer and evidence class already on file." }],
      },
      {
        id: "products",
        chapterId: "concept",
        title: "Products & Services",
        tagline: "Define the products and services you plan to sell and describe the value you give customers — your unique selling proposition.",
        welcome: "Start by outlining your value proposition — what makes your products stand out, be it price, quality or innovation. Then list your product/service portfolio, spotlighting the key benefit of each.",
        fields: [{ key: "valueProposition", label: "Value proposition", hint: "How your products or services will benefit your customers", ai: true, rows: 6 }],
        itemSchema: {
          listKey: "products", label: "Product / service portfolio", addLabel: "Add product or service", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Name", type: "text", placeholder: "e.g. Artisan bread line" },
            { key: "description", label: "Description", type: "textarea", placeholder: "What is it?" },
            { key: "benefit", label: "Key benefit", type: "textarea", placeholder: "Why does a customer want this?" },
          ],
        },
      },
      {
        id: "marketing",
        chapterId: "concept",
        title: "Marketing",
        tagline: "Explain your marketing strategy, how people will discover your offer, and how you will promote it.",
        welcome: "Begin with an overview of your marketing plan — how you'll promote the business and attract customers. Then list the specific marketing activities you'll focus on.",
        fields: [{ key: "marketingPlan", label: "Marketing plan", hint: "Outline the marketing strategy, objectives and tactics", ai: true, rows: 6 }],
        itemSchema: {
          listKey: "activities", label: "Marketing activities", addLabel: "Add marketing activity", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Activity", type: "text", placeholder: "e.g. Instagram photo contest" },
            { key: "description", label: "Description", type: "textarea", placeholder: "What will you actually do?" },
          ],
        },
      },
      {
        id: "sales",
        chapterId: "concept",
        title: "Sales",
        tagline: "Define how you plan to generate sales and what sales and distribution channels you will use.",
        welcome: "Start with your general sales and distribution plan — online, offline, or both. Then list the specific sales channels you'll use to reach customers.",
        fields: [{ key: "salesPlan", label: "Sales & distribution plan", hint: "Describe how you will reach your customers", ai: true, rows: 6 }],
        itemSchema: {
          listKey: "channels", label: "Sales & distribution channels", addLabel: "Add sales channel", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Channel", type: "text", placeholder: "e.g. Online ordering & delivery" },
            { key: "description", label: "Description", type: "textarea", placeholder: "How does this channel work?" },
          ],
        },
      },
      {
        id: "partners",
        chapterId: "concept",
        title: "Partners",
        tagline: "Describe the relationship with key partners and suppliers, and how they help make your idea a success.",
        welcome: "Outline your partnership strategy — your supply chain and relationships with suppliers and other key partners. Then list who you plan to work with and their role.",
        fields: [{ key: "partnershipStrategy", label: "Partnership strategy", hint: "The business relationships you will establish", ai: true, rows: 6 }],
        itemSchema: {
          listKey: "partners", label: "Key partners", addLabel: "Add partner", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Partner", type: "text", placeholder: "e.g. Local ingredient suppliers" },
            { key: "description", label: "Role", type: "textarea", placeholder: "What do they do for you?" },
          ],
        },
      },
    ],
  },
  {
    id: "research",
    title: "Research",
    tagline: "Explore your market, identify customers, analyze competitors, and assess market potential.",
    steps: [
      {
        id: "market",
        chapterId: "research",
        title: "Market",
        tagline: "Provide an overview of your market and the trends shaping the industry, and assess how big and how fast it's growing.",
        welcome: "Start with a market overview drawing on real, sourced sector signals from Trend Radar. Then note your market coverage and growth-rate assessment — your own honest read, not a researched claim.",
        fields: [
          { key: "marketOverview", label: "Market overview", hint: "Briefly describe your market dynamics", ai: true, rows: 6 },
          { key: "coverage", label: "Market coverage", hint: "The scale you plan to serve", kind: "select", options: ["", "Local", "Regional", "National", "International"] },
          { key: "growthRate", label: "Growth rate", hint: "Your own assessment — not a researched claim", kind: "select", options: ["", "New / emerging", "Growing", "Stagnating", "Declining"] },
        ],
        linked: [{ label: "Trend Radar", href: "/dashboard/trends", note: "Real, cited Gen Z / India sector signals — the sourced context behind your market overview." }],
      },
      {
        id: "customers",
        chapterId: "research",
        title: "Customers",
        tagline: "Describe your audience and build profiles of your target customers — their pain points, needs and priority.",
        welcome: "Start with an overall description of who will use your product. Then build a profile per target segment — pain points, and your own honest 1-5 read on segment size, willingness to pay and accessibility. Priority is calculated from your own scores, never invented.",
        fields: [{ key: "targetAudience", label: "Target audience", hint: "Summarize your customers and their needs", ai: true, rows: 6 }],
        itemSchema: {
          listKey: "profiles", label: "Target customer profiles", addLabel: "Add target customer", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Segment name", type: "text", placeholder: "e.g. Health-conscious consumers" },
            { key: "painPoints", label: "Pain points", type: "textarea", placeholder: "What do they struggle with?" },
            { key: "segmentSize", label: "Segment size (1-5, your own estimate)", type: "select", options: ["1", "2", "3", "4", "5"] },
            { key: "willingnessToPay", label: "Willingness to pay (1-5)", type: "select", options: ["1", "2", "3", "4", "5"] },
            { key: "accessibility", label: "Accessibility (1-5)", type: "select", options: ["1", "2", "3", "4", "5"] },
          ],
          priority: { fieldKeys: ["segmentSize", "willingnessToPay", "accessibility"] },
        },
      },
      {
        id: "competitors",
        chapterId: "research",
        title: "Competitors",
        tagline: "Describe the competitive landscape and the key players and trends shaping it.",
        welcome: "Summarize the competitive landscape in your own words. Your actual competitor-by-competitor tracking — with real sourced status and re-check dates — lives in Rival Radar, linked below, so it never goes stale here.",
        fields: [{ key: "competitiveLandscape", label: "Competitive landscape", hint: "Analyze your competitors and market positioning", ai: true, rows: 6 }],
        linked: [{ label: "Rival Radar", href: "/dashboard/rivals", note: "Your real, sourced comparable companies — status, source link and last-rechecked date." }],
      },
      {
        id: "swot",
        chapterId: "research",
        title: "SWOT Analysis",
        tagline: "Identify your strengths, weaknesses, opportunities and threats.",
        welcome: "Fill in each quadrant with short, honest points — your own assessment. This is a founder self-assessment tool, not a researched claim about the market.",
        fields: [],
        swot: true,
      },
      {
        id: "market-potential",
        chapterId: "research",
        title: "Market Potential",
        tagline: "Assess the size of the opportunity and your own estimate of market potential.",
        welcome: "Summarize why you believe this market is worth entering. If you have a market-size estimate, label it clearly as your own back-of-envelope number, not a cited figure, unless you've added a sourced item to your Evidence Register.",
        fields: [
          { key: "marketPotential", label: "Market potential", hint: "Why this opportunity is worth pursuing", ai: true, rows: 5 },
          { key: "marketSizeEstimate", label: "Your market size estimate (₹, optional)", hint: "Your own back-of-envelope number — not a researched claim unless cited in your Evidence Register", kind: "textarea", rows: 2 },
        ],
        linked: [{ label: "Evidence Register", href: "/dashboard/evidence", note: "Add a sourced market-size figure here if you find one, so it's cited rather than estimated." }],
      },
    ],
  },
  {
    id: "setup",
    title: "Set Up",
    tagline: "Estimate startup costs, identify funding sources, and outline your team and business structure.",
    steps: [
      {
        id: "startup-costs",
        chapterId: "setup",
        title: "Startup Costs",
        tagline: "Estimate what it costs to get this business off the ground.",
        welcome: "Your one-time startup cost model (land/building, machinery, working capital margin, preliminary expenses, contingency) already lives in India Ledger — linked below — so it stays in one place instead of being duplicated here.",
        fields: [{ key: "startupCostsNotes", label: "Notes on your startup costs", hint: "Anything not captured by the numbers", rows: 4 }],
        linked: [{ label: "India Ledger (DPR)", href: "/dashboard/dpr", note: "Your real one-time startup cost inputs and the computed project cost." }],
      },
      {
        id: "financing",
        chapterId: "setup",
        title: "Financing",
        tagline: "Identify how you'll fund the business — your own capital, loans, and outside investors.",
        welcome: "Loan and promoter-contribution numbers live in India Ledger; investor, incubator and grant contacts live in Investor Ecosystem. Summarize your overall financing plan here in your own words, and use the links below for the real numbers and contacts.",
        fields: [{ key: "financingPlan", label: "Financing plan", hint: "How you plan to fund this business", ai: true, rows: 6 }],
        linked: [
          { label: "India Ledger (DPR)", href: "/dashboard/dpr", note: "Term loan, working-capital loan and promoter contribution inputs." },
          { label: "Investor Ecosystem", href: "/dashboard/ecosystem", note: "Real investor, incubator, accelerator and grant contacts you're tracking." },
        ],
      },
      {
        id: "team",
        chapterId: "setup",
        title: "Management Team",
        tagline: "Introduce the people behind the business and what they bring to it.",
        welcome: "Start with an overview of your team, then add each member with their role and background.",
        fields: [{ key: "teamOverview", label: "Team overview", hint: "Who is on the team and why they're the right people", ai: true, rows: 5 }],
        itemSchema: {
          listKey: "members", label: "Team members", addLabel: "Add team member", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Name", type: "text", placeholder: "e.g. You" },
            { key: "role", label: "Role", type: "text", placeholder: "e.g. Founder & Head Baker" },
            { key: "bio", label: "Background", type: "textarea", placeholder: "Relevant experience or skills" },
          ],
        },
      },
      {
        id: "payroll",
        chapterId: "setup",
        title: "Payroll Expenses",
        tagline: "Estimate the monthly cost of your team.",
        welcome: "List each role you'll pay for and its monthly cost — the total below is calculated directly from what you enter, never estimated for you.",
        fields: [],
        itemSchema: {
          listKey: "roles", label: "Roles & monthly pay", addLabel: "Add role", itemLabelKey: "role",
          fields: [
            { key: "role", label: "Role", type: "text", placeholder: "e.g. Baker" },
            { key: "count", label: "Headcount", type: "number", placeholder: "1" },
            { key: "monthlySalary", label: "Monthly salary per head (₹)", type: "number", placeholder: "0" },
          ],
          total: { label: "Total monthly payroll", fieldKeys: ["count", "monthlySalary"], op: "sumProduct", format: "currency" },
        },
      },
      {
        id: "ownership",
        chapterId: "setup",
        title: "Ownership",
        tagline: "Define who owns what share of the business.",
        welcome: "List each owner and their equity share — Z Cubs flags it if your shares don't add to 100%, but never assumes a split for you.",
        fields: [],
        itemSchema: {
          listKey: "owners", label: "Owners & equity", addLabel: "Add owner", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Name", type: "text", placeholder: "e.g. You" },
            { key: "role", label: "Role", type: "text", placeholder: "e.g. Founder" },
            { key: "equityPct", label: "Equity %", type: "number", placeholder: "0" },
          ],
          total: { label: "Total equity allocated", fieldKeys: ["equityPct"], op: "sum", format: "percent", warnIfNot: 100 },
        },
      },
    ],
  },
  {
    id: "projections",
    title: "Projections",
    tagline: "Define your revenue model, estimate costs, and project profit, loss, and cash flow.",
    steps: [
      {
        id: "revenue",
        chapterId: "projections",
        title: "Revenue Streams",
        tagline: "Name how the business actually makes money.",
        welcome: "Your price, starting volume and growth-rate assumptions live in Money Lab as driver-based scenarios. Here, just name and describe each distinct revenue stream.",
        fields: [],
        itemSchema: {
          listKey: "streams", label: "Named revenue streams", addLabel: "Add revenue stream", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Stream", type: "text", placeholder: "e.g. In-store bakery sales" },
            { key: "description", label: "Description", type: "textarea", placeholder: "How does this stream work?" },
          ],
        },
        linked: [{ label: "Money Lab", href: "/dashboard/money", note: "Your real price, volume and growth-rate assumptions, in four scenarios." }],
      },
      {
        id: "direct-costs",
        chapterId: "projections",
        title: "Direct Costs",
        tagline: "The costs directly tied to producing what you sell.",
        welcome: "Your cost-of-goods-sold percentage assumption lives in Money Lab. Use this space to describe what actually makes up your direct costs.",
        fields: [{ key: "directCostsNotes", label: "What makes up your direct costs", hint: "Ingredients, packaging, direct labour, etc.", rows: 5 }],
        linked: [{ label: "Money Lab", href: "/dashboard/money", note: "Your COGS % assumption, per scenario." }],
      },
      {
        id: "marketing-costs",
        chapterId: "projections",
        title: "Marketing Costs",
        tagline: "Budget the cost of the marketing activities you defined earlier.",
        welcome: "List your planned monthly marketing spend by line item — the total is calculated directly from what you enter.",
        fields: [],
        itemSchema: {
          listKey: "lines", label: "Marketing budget line items", addLabel: "Add line item", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Line item", type: "text", placeholder: "e.g. Instagram ads" },
            { key: "monthlyAmount", label: "Monthly amount (₹)", type: "number", placeholder: "0" },
          ],
          total: { label: "Total monthly marketing spend", fieldKeys: ["monthlyAmount"], op: "sum", format: "currency" },
        },
      },
      {
        id: "overhead",
        chapterId: "projections",
        title: "Overhead Expenses",
        tagline: "The fixed costs of running the business, independent of sales volume.",
        welcome: "Your total fixed-monthly assumption lives in Money Lab. Use this space to break it down by line item — the breakdown total is calculated from what you enter.",
        fields: [],
        itemSchema: {
          listKey: "lines", label: "Overhead line items", addLabel: "Add line item", itemLabelKey: "name",
          fields: [
            { key: "name", label: "Line item", type: "text", placeholder: "e.g. Rent" },
            { key: "monthlyAmount", label: "Monthly amount (₹)", type: "number", placeholder: "0" },
          ],
          total: { label: "Total monthly overhead", fieldKeys: ["monthlyAmount"], op: "sum", format: "currency" },
        },
        linked: [{ label: "Money Lab", href: "/dashboard/money", note: "Your total fixed-monthly cost assumption, per scenario." }],
      },
      {
        id: "profit-cash-flow",
        chapterId: "projections",
        title: "Profit & Cash Flow",
        tagline: "Bring it together — what the business is projected to earn and keep.",
        welcome: "The actual profit, loss and cash-flow projection is computed live in Money Lab from your real driver assumptions across four scenarios, so it's never duplicated or allowed to go stale here.",
        fields: [{ key: "profitCashFlowSummary", label: "Your summary", hint: "In your own words, what does the Money Lab projection tell you?", rows: 5 }],
        linked: [{ label: "Money Lab", href: "/dashboard/money", note: "Live conservative / base / upside / stress projections from your real inputs." }],
      },
    ],
  },
];

export function findStep(chapterId: string, stepId: string): { chapter: GuideChapter; step: GuideStep } | null {
  const chapter = GUIDE_CHAPTERS.find((c) => c.id === chapterId);
  if (!chapter) return null;
  const step = chapter.steps.find((s) => s.id === stepId);
  if (!step) return null;
  return { chapter, step };
}
export function allSteps(): GuideStep[] {
  return GUIDE_CHAPTERS.flatMap((c) => c.steps);
}
export function stepNeighbors(chapterId: string, stepId: string): { prev: GuideStep | null; next: GuideStep | null } {
  const flat = allSteps();
  const idx = flat.findIndex((s) => s.chapterId === chapterId && s.id === stepId);
  if (idx === -1) return { prev: null, next: null };
  return { prev: idx > 0 ? flat[idx - 1] : null, next: idx < flat.length - 1 ? flat[idx + 1] : null };
}
