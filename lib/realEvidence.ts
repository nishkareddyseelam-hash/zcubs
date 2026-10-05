// Real, sourced reference data verified by web search on 26 Aug 2026.
// Nothing here is invented — each item carries a genuine publisher and URL.

export const REAL_EVIDENCE = [
  {
    claim: "Total enrolment in Indian higher education, 2023-24",
    metric: "4.50 crore (45 million) students · GER 30 (female GER 31.2)",
    publisher: "Ministry of Education, Government of India (PIB)",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2282525",
    pubDate: "8 Jul 2026",
    accessDate: "26 Aug 2026",
    cls: "official",
    limitations: "National aggregate only — no city or campus-level breakdown; not specific to any venture.",
  },
];

export const REAL_COMPETITORS = [
  {
    name: "NoBroker",
    geo: "National (HQ Bengaluru)",
    founded: "2014",
    founders: "Akhil Gupta, Amit Agarwal, Saurabh Garg",
    model: "Brokerage-free property discovery (buy/sell/rent) plus ancillary services",
    funding: "$376M raised across 10 rounds; latest Series E, 28 Feb 2023",
    traction: "FY24 revenue ₹888.3 Cr (+29.98% YoY); ~6,149 employees (as reported)",
    source: "Inc42 company profile",
    url: "https://inc42.com/company/nobroker/",
    accessDate: "26 Aug 2026",
    confidence: "Medium — third-party aggregator, not a primary filing",
    unknowns: "No public breakdown of student or short-stay sublet volume",
  },
  {
    name: "Stanza Living",
    geo: "National, 14 cities as of Nov 2020 (HQ Delhi)",
    founded: "2017",
    founders: "Anindya Dutta, Sandeep Dalmia",
    model: "Tech-enabled, full-stack managed co-living for students and professionals",
    funding: "$70.2M total across 5 rounds; ₹69 Cr round closed Nov 2020",
    traction: "50,000+ beds across 150+ residences (as reported, Nov 2020)",
    source: "Inc42",
    url: "https://inc42.com/buzz/exclusive-student-housing-startup-stanza-living-raises-69-cr/",
    accessDate: "26 Aug 2026",
    confidence: "Medium — figures reflect the article's publication date",
    unknowns: "Current city count, bed count and profitability not verified here",
  },
  {
    name: "Zolo Stays",
    geo: "National (HQ Bengaluru)",
    founded: "2015",
    founders: "Akhil Sikri, Nikhil Sikri, Sneha Choudhry",
    model: "Managed rental & co-living via 'Zolo Select' (premium) and 'Zolo Standard' (affordable/PG)",
    funding: "~$35M raised by 2019; no confirmed recent round found",
    traction: "Not verified in this session",
    source: "Whizsky company profile (secondary source)",
    url: "https://www.whizsky.com/zolostays-founder-funding-business-model-and-competitors/",
    accessDate: "26 Aug 2026",
    confidence: "Low-Medium — single secondary source, funding figure dated",
    unknowns: "No confirmed funding or scale data after 2019 found",
  },
];

export const REJECTED_EVIDENCE_NOTE =
  "One market-size report found during research (a third-party \"India student accommodation market\" estimate) valued the market in the hundreds of billions of US dollars — implausible against India's GDP, and almost certainly a data-quality error on the publisher's side. It has been excluded rather than shown. A wrong number with a citation attached is more dangerous than an honest \"reliable evidence not found.\"";

export const EVIDENCE_CLASSES: Record<string, { label: string; className: string }> = {
  official: { label: "Official government source", className: "badge-green" },
  company: { label: "Company disclosure / press coverage", className: "badge-teal" },
  user: { label: "Your own input", className: "badge-blue" },
  derived: { label: "Derived calculation", className: "badge-purple" },
  estimate: { label: "External estimate", className: "badge-amber" },
  forecast: { label: "Forecast", className: "badge-amber" },
  analyst: { label: "Analyst interpretation", className: "badge-purple" },
  assumption: { label: "Explicit assumption", className: "badge-grey" },
  notfound: { label: "Reliable evidence not found", className: "badge-red" },
};
