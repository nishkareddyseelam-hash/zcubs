// Server-only helper for calling the Anthropic Messages API. The API key
// never leaves the server — this file must never be imported from a
// "use client" component. When no key is configured, callers fall back to
// their own curated, honestly-labelled suggestions rather than fabricating
// an "AI" response.
import { checkAiQuota, recordAiUsage } from "./aiQuota";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export const AI_ENABLED = !!process.env.ANTHROPIC_API_KEY;

/**
 * Calls Claude with a system prompt and a user prompt. Returns the raw text
 * reply, or null if no API key is configured, the call fails, or it times
 * out — callers must treat null as "fall back", never surface it as an error
 * to the end user (a slow or unavailable AI call should degrade gracefully,
 * not break the form).
 */
export async function callClaude(
  system: string,
  userPrompt: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
        max_tokens: opts.maxTokens ?? 500,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 9000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const block = data.content?.find((b) => b.type === "text" && typeof b.text === "string");
    return block?.text ?? null;
  } catch {
    return null;
  }
}

/**
 * D-011 quota-aware wrapper around callClaude — use this at every real
 * call site instead of calling callClaude directly. Checks the caller's
 * plan-based daily limit AND the platform-wide daily cap (aiQuota.ts)
 * before spending a real call, and always records the attempt (allowed or
 * blocked) so usage is auditable. A blocked call returns null exactly like
 * "no API key configured" does — callers already have to handle that as
 * "fall back to the curated/non-AI path", so quota exhaustion degrades
 * gracefully with no separate error-handling path needed.
 */
export async function callClaudeForUser(
  userId: string,
  feature: string,
  system: string,
  userPrompt: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  if (!AI_ENABLED) return null;
  const quota = await checkAiQuota(userId);
  if (!quota.allowed) {
    await recordAiUsage(userId, feature, false, quota.reason);
    return null;
  }
  await recordAiUsage(userId, feature, true);
  return callClaude(system, userPrompt, opts);
}

/** Parses a JSON array of strings out of a Claude reply, tolerating stray
 * prose or a fenced code block around it. Returns null if nothing usable
 * could be parsed — callers fall back to curated suggestions. */
export function parseStringArray(text: string | null, max = 8): string[] | null {
  if (!text) return null;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    const cleaned = arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned.slice(0, max) : null;
  } catch {
    return null;
  }
}

/** Parses a single JSON object out of a Claude reply, tolerating stray
 * prose or a fenced code block around it. Returns null if nothing usable
 * could be parsed — callers fall back to a non-AI path. Only string-valued
 * keys listed in `keys` are kept, and only if non-empty after trimming —
 * this is used for idea generation, where every field must be something
 * the founder can see and edit, never silently invented structure. */
export function parseJsonObject(text: string | null, keys: string[]): Record<string, string> | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = (obj as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim().length > 0) out[k] = v.trim();
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
