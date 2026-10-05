import * as repo from "./repo";
import type { Territory } from "@/components/TerritoryMap";

/** Single source of truth for the Founder World territory list, shared by
 * the full Founder World map and the Home page's compact preview — every
 * `done` flag is computed from real workspace rows, never hardcoded. */
export async function getTerritories(userId: string): Promise<Territory[]> {
  const profile = await repo.getFounderProfile(userId);
  const opportunities = await repo.listOpportunities(userId);
  const experiments = await repo.listExperiments(userId);
  const risks = await repo.listRisks(userId);

  return [
    { name: "Self Discovery", desc: "Founder Fit Map from strengths, values and constraints.", href: "/dashboard/fitmap", done: !!profile },
    { name: "Problem City", desc: "Structured problem-observation, folded into Self Discovery.", href: "/dashboard/fitmap", done: !!profile },
    { name: "Opportunity Forest", desc: "Opportunity Cards you build from evidence you've gathered.", href: "/dashboard/opportunities", done: opportunities.length > 0 },
    { name: "Idea Arena", desc: "Weighted comparison across the ideas you've added.", href: "/dashboard/arena", done: opportunities.length >= 2 },
    { name: "Evidence Lab", desc: "A real, sourced evidence register — plus your own additions.", href: "/dashboard/evidence", done: true },
    { name: "Trend Radar", desc: "Real, sourced Gen Z sector signals — click to add to Self Discovery.", href: "/dashboard/trends", done: true },
    { name: "Rival Radar", desc: "Real, sourced facts on India rental/co-living comparables.", href: "/dashboard/rivals", done: true },
    { name: "Customer Street", desc: "Interview and experiment templates you fill in.", href: "/dashboard/validation", done: experiments.length > 0 },
    { name: "Money Lab", desc: "Scenario-based financial modelling.", href: "/dashboard/money", done: true },
    { name: "Risk Fortress", desc: "Assumption and risk register.", href: "/dashboard/passport", done: risks.length > 0 },
    { name: "Pilot Ground", desc: "Lean pilot and MVP budget planning — planned for a later release.", href: null, done: false },
    { name: "Pitch Studio", desc: "Pitch deck and teaser drafting.", href: "/dashboard/launch", done: false },
    { name: "India Launch Hub", desc: "DPR, incubator and grant application drafts.", href: "/dashboard/launch", done: false },
    { name: "Growth Command Centre", desc: "Post-launch analytics — opens once you have live pilot data.", href: null, done: false },
  ];
}
