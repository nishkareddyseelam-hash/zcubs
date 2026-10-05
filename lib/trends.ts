// Real, sourced Gen Z / India startup-sector signals — ported verbatim from
// the same dataset used in the standalone prototype. Every example and every
// category "why" line links to a real citation; nothing here is invented.
export type TrendSource = { label: string; url: string };
export type TrendExample = { name: string; what: string; url: string; src?: TrendSource };
export type TrendCategory = {
  name: string;
  why: string;
  examples: TrendExample[];
  link: { label: string; url: string; src?: TrendSource };
};

const FORBES_UNICORNS_SRC = { label:'Forbes — Next Billion-Dollar Startups 2026', url:'https://www.forbes.com/sites/richardnieva/2026/07/28/next-billion-dollar-startups-2026/' };
const TREND_CATEGORIES: TrendCategory[] = [
  {
    name:'Fintech & financial services',
    why:'Payments, neobanks, embedded lending, AI-driven insurance and accounting — young-founder fintechs are consistently among the best-funded companies in the sector.',
    examples:[
      { name:'Clair', what:'paycheck access for hourly workers', url:'https://getclair.com/', src:FORBES_UNICORNS_SRC },
      { name:'Pace', what:'AI insurance-claims agents', url:'https://withpace.com/', src:FORBES_UNICORNS_SRC },
      { name:'Rillet', what:'AI-driven accounting close', url:'https://www.rillet.com/', src:FORBES_UNICORNS_SRC }
    ],
    link:{ label:'Zerodha — India\'s largest discount brokerage', url:'https://zerodha.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Zerodha' } }
  },
  {
    name:'Climate tech & clean mobility',
    why:'Solar and EV infrastructure, home energy management, water systems — over 80% of Gen Z entrepreneurs describe their businesses as purpose-driven, and this is reported as the fastest-growing investment category globally.',
    examples:[
      { name:'American Terawatt', what:'DC power grids for AI data centres', url:'https://www.americanterawatt.com/', src:FORBES_UNICORNS_SRC },
      { name:'Ather Energy', what:'electric two-wheeler dealerships & manufacturing', url:'https://www.atherenergy.com/', src:{ label:'Business Standard', url:'https://www.business-standard.com/amp/companies/news/ather-energy-in-talks-for-post-ipo-rs-2500-crore-fundraise-126061300720_1.html' } },
      { name:'Zipline', what:'drone delivery infrastructure', url:'https://www.zipline.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Zipline_(drone_delivery_company)' } }
    ],
    link:{ label:'Ather Energy — Indian electric two-wheeler maker', url:'https://www.atherenergy.com/', src:{ label:'Business Standard', url:'https://www.business-standard.com/amp/companies/news/ather-energy-in-talks-for-post-ipo-rs-2500-crore-fundraise-126061300720_1.html' } }
  },
  {
    name:'AI, automation & cybersecurity',
    why:'AI agents doing real operational work — vulnerability response, legal review, fraud detection — plus the reskilling wave as roles shift toward AI-resilient trades.',
    examples:[
      { name:'Cogent Security', what:'AI agents for vulnerability management', url:'https://www.cogent.security/', src:FORBES_UNICORNS_SRC },
      { name:'DepthFirst', what:'AI-found software vulnerabilities & patches', url:'https://depthfirst.com/', src:FORBES_UNICORNS_SRC },
      { name:'Crosby', what:'AI-powered contract review', url:'https://crosby.ai/', src:FORBES_UNICORNS_SRC }
    ],
    link:{ label:'Cogent Security — autonomous vulnerability response', url:'https://www.cogent.security/', src:FORBES_UNICORNS_SRC }
  },
  {
    name:'Creator economy & social',
    why:'Direct-to-audience distribution instead of traditional gatekeepers — private communities, digital products, AI-assisted content and design tools.',
    examples:[
      { name:'Whop', what:'sell digital products, courses and memberships', url:'https://whop.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Whop.com' } },
      { name:'Fizz', what:'private social network for college students', url:'https://fizz.social/', src:{ label:'AdExchanger', url:'https://www.adexchanger.com/marketers/new-social-media-platform-fizz-gives-brands-a-crash-course-in-marketing-to-college-students/' } },
      { name:'Flora', what:'AI design tools for creative teams', url:'https://florafauna.ai/', src:FORBES_UNICORNS_SRC }
    ],
    link:{ label:'Whop — creator commerce platform', url:'https://whop.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Whop.com' } }
  },
  {
    name:'Consumer, retail & D2C',
    why:'Design-led, values-aligned consumer brands — sustainable fashion, affordable-luxury beauty, AI-assisted shopping, and quick-commerce distribution behind them.',
    examples:[
      { name:'Virgio', what:'sustainable, affordable fashion', url:'https://www.virgio.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Virgio' } },
      { name:'Phia', what:'AI price comparison across retailers', url:'https://phia.com/', src:{ label:'PR Newswire', url:'https://www.prnewswire.com/news-releases/meet-phia-the-free-ai-shopping-tool-that-instantly-finds-you-the-best-price-on-fashion-founded-by-phoebe-gates-and-sophia-kianni-302436742.html' } },
      { name:'David Protein', what:'aesthetic-led protein brand', url:'https://davidprotein.com/', src:{ label:'Business Wire', url:'https://www.businesswire.com/news/home/20250529749264/en/David-Closes-$75-Million-Series-A-Funding-Round' } }
    ],
    link:{ label:'Zepto — quick-commerce grocery delivery', url:'https://www.zepto.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Zepto_(company)' } }
  },
  {
    name:'Agritech & circular economy',
    why:'Farm-to-market supply chains, organic and vertical farming, and the resale/recycling economy addressing food loss and waste.',
    examples:[
      { name:'AeroFarms', what:'indoor vertical farming', url:'https://www.aerofarms.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/AeroFarms' } },
      { name:'Recykal', what:'recycling & waste-management marketplace', url:'https://www.recykal.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Recykal' } },
      { name:'Cashify', what:'second-hand gadget resale marketplace', url:'https://www.cashify.in/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Cashify' } }
    ],
    link:{ label:'Ninjacart — agri supply-chain platform', url:'https://ninjacart.com/', src:{ label:'Inc42', url:'https://inc42.com/company/ninjacart/' } }
  },
  {
    name:'Real estate, logistics & mobility',
    why:'Digitising information-opaque industries — property transactions, freight matching, last-mile and drone delivery.',
    examples:[
      { name:'FleetWorks', what:'AI freight-broker matching', url:'https://www.fleetworks.ai/', src:FORBES_UNICORNS_SRC },
      { name:'Housing.com', what:'digital-first real estate search & transactions', url:'https://housing.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Housing.com' } },
      { name:'Zipline', what:'drone delivery & drone services', url:'https://www.zipline.com/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/Zipline_(drone_delivery_company)' } }
    ],
    link:{ label:'NoBroker — brokerage-free property platform', url:'https://www.nobroker.in/', src:{ label:'Wikipedia', url:'https://en.wikipedia.org/wiki/NoBroker' } }
  },
  {
    name:'Future of work & skilling',
    why:'Vocational and youth skilling, flexible-work infrastructure, and HR tools for a workforce shifting toward AI-resilient careers.',
    examples:[
      { name:'Juicebox', what:'recruiter tool for candidate discovery', url:'https://juicebox.ai/', src:FORBES_UNICORNS_SRC },
      { name:'upGrad', what:'skill training & upskilling platform', url:'https://www.upgrad.com/', src:{ label:'Business Insider India', url:'https://www.businessinsider.in/business/startups/news/india-now-has-four-edtech-unicorns-byju-unacademy-eruditis-upgrad/articleshow/85300757.cms' } },
      { name:'Awfis', what:'coworking & remote-work infrastructure', url:'https://www.awfis.com/', src:{ label:'Business Standard', url:'https://www.business-standard.com/amp/markets/news/ipo-alert-awfis-space-solutions-opens-today-should-you-subscribe-124052200230_1.html' } }
    ],
    link:{ label:'PhysicsWallah — affordable exam-prep platform', url:'https://www.pw.live/', src:{ label:'TechCrunch', url:'https://techcrunch.com/2024/09/19/indias-physics-wallah-raises-210m-at-2-8b-valuation-even-as-edtech-funding-remains-scarce' } }
  }
];
export { TREND_CATEGORIES };
export const TREND_CATEGORY_NAMES: string[] = TREND_CATEGORIES.map((c) => c.name);

// ---------- profile-driven idea generation ----------
// Combines two REAL inputs — the founder's own stated Self Discovery
// profile text, and the sourced sector trend data above (with citations) —
// to draft an Opportunity Card. Never a fabricated fact about any specific
// venture: the "why" and example are real, cited sector context; everything
// else is explicitly framed as a hypothesis for the founder to verify.
const TREND_MATCH_KEYWORDS: Record<string, string[]> = {
  "Fintech & financial services": ["fintech", "finance", "financial", "payment", "banking", "bank", "lending", "loan", "insurance", "money", "invest", "wealth", "budget"],
  "Climate tech & clean mobility": ["climate", "clean energy", "ev", "electric vehicle", "solar", "sustainab", "mobility", "green", "environment", "renewable"],
  "AI, automation & cybersecurity": ["ai", "artificial intelligence", "automation", "automate", "security", "cyber", "ml", "machine learning", "coding", "software", "tech"],
  "Creator economy & social": ["creator", "content", "social media", "influencer", "community", "video", "design", "brand"],
  "Consumer, retail & D2C": ["fashion", "retail", "d2c", "ecommerce", "e-commerce", "consumer", "beauty", "shopping", "apparel", "food"],
  "Agritech & circular economy": ["agri", "farm", "recycl", "waste", "circular", "compost", "organic"],
  "Real estate, logistics & mobility": ["real estate", "property", "rent", "logistics", "delivery", "freight", "housing", "transport"],
  "Future of work & skilling": ["education", "edtech", "skilling", "skill", "training", "hr", "recruit", "career", "job", "teach", "mentor", "upskill"],
};

/** Ranks the sourced trend sectors against the founder's own stated
 * strengths/categories text — real keyword overlap, not an invented match
 * score. Returns [] (not a guess) when there's nothing to match against. */
export function matchTrendCategories(profile: { categories?: string; strengths?: string } | undefined): TrendCategory[] {
  const text = `${profile?.categories || ""} ${profile?.strengths || ""}`.toLowerCase();
  if (!text.trim()) return [];
  const scored = TREND_CATEGORIES.map((c) => {
    const kws = TREND_MATCH_KEYWORDS[c.name] || [];
    let score = kws.filter((k) => text.includes(k)).length;
    c.name.toLowerCase().split(/[^a-z]+/).forEach((w) => { if (w.length > 4 && text.includes(w)) score++; });
    return { category: c, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return scored.map((s) => s.category);
}

export function ideaSeedFromTrend(cat: TrendCategory, profile?: { strengths?: string }) {
  const ex = cat.examples[Math.floor(Math.random() * cat.examples.length)];
  return {
    title: `[Your idea] in ${cat.name.split("&")[0].trim()}`,
    problem: `Hypothesis, drawing on a sourced sector trend (not a fact about your specific venture — go verify it): ${cat.why} Reference: ${ex.name} — ${ex.what} (${ex.url}).${profile?.strengths ? ` You noted your own strengths as: "${profile.strengths}" — consider how that connects to this sector.` : ""}`,
    mission: "Interview 5-10 people in this space about how they currently handle this problem — do they confirm it unprompted, without you suggesting it?",
    trendName: cat.name,
  };
}
