import { TREND_CATEGORIES, matchTrendCategories, ideaSeedFromTrend } from "@/lib/trends";
import { CURATED_IDEA_SEEDS, CURATED_SUGGESTIONS } from "@/lib/suggestData";
import type { GuideMeta } from "@/lib/repo";
import type { GuideDraftContext } from "@/lib/guideAutoDraft";

/**
 * Same real-signal resolution as /api/generate-idea (an explicit template
 * tile takes priority, then a profile match against sourced Trend Radar
 * sectors, then a generic honestly-labelled pattern) — factored out so the
 * template-start bulk flow and the "just name it, no template" Guide entry
 * point both produce a consistent seed. Category/pattern are both optional:
 * when neither is given, a generic pattern is still picked (never leaves
 * the founder with nothing to draft from).
 */
export function resolveTemplateSeedServer(
  profileCtx: Record<string, string>,
  category?: string,
  pattern?: string
): { customer: string; problem: string; mission: string; templateLabel: string | null } {
  const explicitTrend = category ? TREND_CATEGORIES.find((c) => c.name === category) || null : null;
  const trendMatches = matchTrendCategories(profileCtx);
  const bestTrend = explicitTrend || (trendMatches.length ? trendMatches[Math.floor(Math.random() * Math.min(2, trendMatches.length))] : null);
  const patternSeed = !bestTrend && pattern ? CURATED_IDEA_SEEDS.find((s) => s.id === pattern) : null;

  let customer = "";
  let problem = "";
  let mission = "";
  let templateLabel: string | null = null;
  if (bestTrend) {
    const seed = ideaSeedFromTrend(bestTrend, {});
    const customerOptions = CURATED_SUGGESTIONS["opportunities.customer"] || [];
    customer = customerOptions[Math.floor(Math.random() * customerOptions.length)] || "";
    problem = seed.problem;
    mission = seed.mission;
    templateLabel = explicitTrend ? explicitTrend.name : bestTrend.name;
  } else {
    const seed = patternSeed || CURATED_IDEA_SEEDS[Math.floor(Math.random() * CURATED_IDEA_SEEDS.length)];
    customer = seed.customer;
    problem = seed.problem;
    mission = seed.mission;
    templateLabel = patternSeed ? patternSeed.label : null;
  }
  problem = problem.replace(/^Hypothesis[^:]*:\s*/i, "");
  return { customer, problem, mission, templateLabel };
}

/** Builds the shared draft context used everywhere a Guide field/item/SWOT
 * suggestion is generated — preferring the most concrete real source: an
 * active Opportunity Card, then the saved guide_meta (business name +
 * seed captured once, reused consistently across every lazily-generated
 * step), then honest bracketed placeholders. Never a fabricated fact. */
export function buildGuideDraftContext(
  meta: GuideMeta,
  opportunity?: { title?: string; customer?: string; problem?: string }
): GuideDraftContext {
  if (opportunity?.title) {
    return {
      businessName: opportunity.title,
      templateLabel: null,
      notes: meta.notes || "",
      opportunity,
    };
  }
  if (meta.businessName) {
    return {
      businessName: meta.businessName,
      templateLabel: meta.templateLabel || null,
      notes: meta.notes || "",
      opportunity: { title: meta.businessName, customer: meta.customer, problem: meta.problem },
    };
  }
  return { businessName: undefined, templateLabel: null, notes: "", opportunity: undefined };
}
