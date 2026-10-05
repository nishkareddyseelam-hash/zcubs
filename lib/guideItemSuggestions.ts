import type { GuideDraftContext } from "@/lib/guideAutoDraft";

type Item = Record<string, string>;

/**
 * Pre-built starting suggestions for every item-list step and the SWOT
 * step — so a first-time founder never faces a blank "add one yourself"
 * box (per the product's own instruction: don't leave a naive user to
 * think and write, support them with something to react to). Every
 * suggestion is either a neutral structural default (a sole founder
 * starting at 100% equity, a ₹0 draw before real revenue exists) or
 * phrased as an editable hypothesis — never a specific invented number
 * (a real salary, a real ad-spend figure, a real market stat) presented as
 * fact. The founder can edit or remove any suggested item, and the
 * existing "add" form still lets them add more of their own.
 */
export function suggestItemsForStep(stepId: string, ctx: GuideDraftContext): Item[] | null {
  const name = ctx.businessName || "your business";
  const cat = ctx.templateLabel;
  const customer = ctx.opportunity?.customer || "your target customer";
  const problem = ctx.opportunity?.problem || "the problem you're addressing";

  switch (stepId) {
    case "products":
      return [
        { name: `${name} — core offer`, description: `The main product/service ${name} sells to ${customer}.`, benefit: `Directly addresses: ${problem}` },
        { name: `${name} — add-on`, description: "A smaller, optional add-on that increases value per customer.", benefit: "Increases average order value or retention — edit to your real plan." },
      ];
    case "marketing":
      return [
        { name: "Organic social content", description: `Regular posts/reels showing ${name} in action, aimed at ${customer}.` },
        { name: "Referral incentive", description: "A small reward for existing users who bring a friend — cheaper than paid ads for a first-time founder." },
        { name: cat ? `Community presence in ${cat}` : "Local/community partnerships", description: `Showing up where ${customer} already spend time.` },
      ];
    case "sales":
      return [
        { name: "Direct online (website/app/DM)", description: "Founder-run ordering or signup — no middleman to start." },
        { name: "Word of mouth / referral", description: `Early adopters among ${customer} refer others once they've tried it.` },
      ];
    case "partners":
      return [
        { name: cat ? `Suppliers relevant to ${cat}` : "Key suppliers", description: "Whoever supplies the inputs this venture depends on — name yours." },
        { name: "Community or campus partner", description: `A group or organisation with direct access to ${customer}.` },
      ];
    case "team":
      return [
        { name: "You", role: "Founder", bio: "Add your own background and why you're building this." },
      ];
    case "payroll":
      // Structure only — a specific salary figure would be an invented
      // fact, so the amount starts at 0 for the founder to set for real.
      return [
        { role: "You (Founder)", count: "1", monthlySalary: "0" },
      ];
    case "ownership":
      // The standard, honest default for a single first-time founder —
      // not an invented split; edit this the moment there's a co-founder.
      return [
        { name: "You", role: "Founder", equityPct: "100" },
      ];
    case "customers":
      return [
        { name: customer, painPoints: problem, segmentSize: "3", willingnessToPay: "3", accessibility: "3" },
      ];
    case "revenue":
      return [
        { name: `${name} — primary sales`, description: `Revenue from ${customer} paying for the core offer.` },
      ];
    case "marketing-costs":
    case "overhead":
      // Line-item names only — a real amount would be an invented figure,
      // so every suggested line starts at ₹0 for the founder to set.
      return stepId === "marketing-costs"
        ? [{ name: "Social media ads", monthlyAmount: "0" }, { name: "Content/design tools", monthlyAmount: "0" }]
        : [{ name: "Rent / workspace", monthlyAmount: "0" }, { name: "Software & subscriptions", monthlyAmount: "0" }];
    default:
      return null;
  }
}

export type SwotSuggestion = { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };

/** SWOT is explicitly a founder self-assessment, not a researched claim —
 * suggestions stay generic/structural except the Opportunities quadrant,
 * which reuses the real, cited Trend Radar "why" text when the context
 * came from an actual matched sector (so it's sourced, not invented). */
export function suggestSwotQuadrants(ctx: GuideDraftContext): SwotSuggestion {
  const name = ctx.businessName || "You";
  const strengths = ctx.notes
    ? [`From your own notes: ${ctx.notes}`]
    : [`${name}'s founder is close to the problem and can move fast without needing sign-off from anyone else.`];
  const weaknesses = ["No existing customers or brand recognition yet — everything starts from zero, so trust has to be earned."];
  const opportunities = ctx.templateLabel
    ? [`Operating in the ${ctx.templateLabel} space — see Trend Radar for the real, sourced sector signal behind this, rather than taking this line as fact.`]
    : ["A specific, underserved segment you can focus on fully before larger competitors notice."];
  const threats = ["An established or better-funded player could copy the model once it starts gaining traction."];
  return { strengths, weaknesses, opportunities, threats };
}
