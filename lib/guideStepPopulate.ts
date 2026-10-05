import * as repo from "@/lib/repo";
import type { GuideStep } from "@/lib/guideStructure";
import { draftGuideFieldText, type GuideDraftContext } from "@/lib/guideAutoDraft";
import { suggestItemsForStep, suggestSwotQuadrants } from "@/lib/guideItemSuggestions";

const SWOT_QUADRANTS = ["strengths", "weaknesses", "opportunities", "threats"] as const;

/**
 * Fills in everything a single Guide step can start with — every
 * AI-eligible narrative field, the item list (if any), and the SWOT
 * quadrants (if this is the SWOT step) — from one real context. Shared by
 * the bulk "start from a template" flow and the lazy "generate live as the
 * founder opens this step" flow, so both behave identically. Never
 * overwrites anything the founder already entered.
 *
 * D-011: the bulk "start from a template" flow (generate-guide-all) calls
 * this once per step across all 20 steps, which can mean dozens of real AI
 * calls in a single request — exactly the runaway-cost shape the AI quota
 * exists for. Each draftGuideFieldText call checks the quota itself
 * (aiClient.ts callClaudeForUser); once a user's daily limit or the
 * platform-wide cap is hit mid-loop, every subsequent field in the same
 * request just falls back to the honest non-AI scaffold — no special
 * handling needed here, and the founder never sees an error, only a
 * gradually more scaffold-heavy result.
 */
export async function populateStepContent(userId: string, step: GuideStep, ctx: GuideDraftContext): Promise<boolean> {
  const existing = await repo.getGuideStep(userId, step.id);
  let touched = false;

  const aiFields = step.fields.filter((f) => f.ai);
  if (aiFields.length) {
    const toSave: Record<string, string> = {};
    const stepContext: Record<string, string> = { ...existing.fields };
    for (const f of aiFields) {
      if ((existing.fields[f.key] || "").trim()) continue;
      const { text } = await draftGuideFieldText(userId, step, f, { ...ctx, stepContext });
      toSave[f.key] = text;
      stepContext[f.key] = text;
      touched = true;
    }
    if (Object.keys(toSave).length) await repo.saveGuideStepFields(userId, step.id, toSave);
  }

  if (step.itemSchema) {
    const listKey = step.itemSchema.listKey;
    const existingItems = (existing.items[listKey] as unknown[]) || [];
    if (!existingItems.length) {
      const suggested = suggestItemsForStep(step.id, ctx);
      if (suggested && suggested.length) {
        await repo.saveGuideStepItems(userId, step.id, listKey, suggested);
        touched = true;
      }
    }
  }

  if (step.swot) {
    const anyFilled = SWOT_QUADRANTS.some((q) => Array.isArray(existing.items[q]) && (existing.items[q] as unknown[]).length > 0);
    if (!anyFilled) {
      const suggested = suggestSwotQuadrants(ctx);
      for (const q of SWOT_QUADRANTS) await repo.saveGuideStepItems(userId, step.id, q, suggested[q]);
      touched = true;
    }
  }

  if (step.id === "idea" && ctx.notes && !existing.notes) {
    await repo.saveGuideStepNotes(userId, step.id, ctx.notes);
    touched = true;
  }

  return touched;
}
