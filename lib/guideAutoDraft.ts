import { AI_ENABLED, callClaudeForUser } from "@/lib/aiClient";
import type { GuideFieldDef, GuideStep } from "@/lib/guideStructure";

/**
 * Shared "draft one Guide field" logic — used both by the single-field
 * "Draft for me" button (src/app/api/generate-guide-field/route.ts) and the
 * bulk "draft everything from a template" flow that runs once, right after
 * a home-page template names the business (src/app/api/generate-guide-all/
 * route.ts). Deliberately the opposite of IdeaBuddy's AI Buddy: that tool
 * writes a fully specific, confident-sounding plan (invented company name,
 * invented customer stats) in one shot. Here the model is explicitly told
 * never to invent a company name, specific statistic, or claim about real
 * competitors — only to draft the founder's OWN idea/profile/notes into
 * hypothesis-labeled prose they must edit. When no AI key is configured, a
 * light non-AI fallback assembles a generic scaffold from the founder's own
 * words instead of prose.
 */
export type GuideDraftContext = {
  businessName?: string;
  templateLabel?: string | null;
  notes?: string;
  opportunity?: { title?: string; customer?: string; problem?: string };
  profile?: Record<string, string>;
  stepContext?: Record<string, string>;
};

export async function draftGuideFieldText(
  userId: string,
  step: GuideStep | null,
  field: GuideFieldDef,
  ctx: GuideDraftContext
): Promise<{ text: string; source: "ai" | "curated" }> {
  const opp = ctx.opportunity || {};
  const profile = ctx.profile || {};
  const businessName = ctx.businessName || opp.title;

  // Only call the model when there's real context to draft from. Calling
  // it on an essentially-empty prompt is what caused the reported bug: with
  // nothing concrete to write about, the model would fall back to generic
  // startup boilerplate — which, regardless of the actual field, tends to
  // default to talking about marketing/social media, since that's the most
  // common generic startup-advice topic. No business name yet -> always use
  // the honest bracketed-placeholder fallback below instead of guessing.
  if (AI_ENABLED && businessName) {
    const contextLines = [
      `Business name: ${businessName}`,
      ctx.templateLabel ? `Template / sector this was started from: ${ctx.templateLabel}` : "",
      opp.customer ? `Target customer: ${opp.customer}` : "",
      opp.problem ? `Problem hypothesis: ${opp.problem}` : "",
      profile.strengths ? `Founder's own stated strengths: ${profile.strengths}` : "",
      profile.categories ? `Founder's own stated interest categories: ${profile.categories}` : "",
      ctx.notes ? `Founder's own notes/summary: ${ctx.notes}` : "",
      ...Object.entries(ctx.stepContext || {})
        .filter(([, v]) => (v || "").trim())
        .map(([k, v]) => `Also already written in this section, field "${k}": ${v}`),
    ].filter(Boolean).join("\n");
    const system = [
      `You draft ONE specific field of a founder's business-planning workspace, and ONLY that field.`,
      `Section: "${step?.title || ""}". Field: "${field.label}"${field.hint ? ` — meaning: ${field.hint}` : ""}.`,
      "Stay strictly on the topic of THIS field. Do not drift into generic marketing, social media, or digital-marketing advice unless the field itself is explicitly about marketing or promotion — a field about team, financing, competitors, partners, or costs must never turn into a marketing pitch.",
      "Reply with ONLY the drafted text for that field — no JSON, no markdown headers, no preamble, no restating the field name.",
      "Write it as a plausible starting draft the founder must review and edit, using ONLY the idea/profile/notes context given below — never invent a specific company name, specific statistic, funding figure, or claim about a real competitor as fact.",
      "If you reference market conditions, phrase them as general, well-known dynamics, not as a specific researched number.",
      "Keep it concrete and specific to the given idea/profile, not generic filler.",
    ].join(" ");
    const reply = await callClaudeForUser(userId, "guide_draft", system, contextLines, { maxTokens: 500 });
    if (reply && reply.trim()) {
      return { text: reply.trim(), source: "ai" };
    }
  }

  // Non-AI fallback: an honest scaffold, not invented prose. Uses the
  // founder's own idea/profile/notes words where available; otherwise a
  // bracketed placeholder they fill in themselves — never a fabricated
  // example business like IdeaBuddy's "Jilo".
  const ideaBit = businessName ? `"${businessName}"` : "[your idea]";
  const customerBit = opp.customer || "[your target customer]";
  const problemBit = opp.problem ? opp.problem.replace(/^Hypothesis[^:]*:\s*/i, "") : "[the problem you're addressing]";
  const notesBit = ctx.notes ? ` From your own notes: "${ctx.notes}".` : "";
  const scaffold = `Draft for "${field.label}", built from your own idea ${ideaBit} and target customer ${customerBit}: ${problemBit}${notesBit} — replace this scaffold with your own words; this is a starting hypothesis, not researched fact.`;
  return { text: scaffold, source: "curated" };
}
