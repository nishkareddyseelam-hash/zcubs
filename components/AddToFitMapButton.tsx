"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PENDING_TREND_PICKS_KEY = "zcubs.pendingTrendCategories";

/** Queues a Trend Radar sector name for the Founder Fit Map's category
 * picker to pick up (see SmartChips), then takes the founder there. This is
 * the actual fix for "clicking a sector doesn't add anything" — previously
 * this button did not exist at all. */
export default function AddToFitMapButton({ name }: { name: string }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  function add() {
    try {
      const raw = window.localStorage.getItem(PENDING_TREND_PICKS_KEY);
      const picks: string[] = raw ? JSON.parse(raw) : [];
      if (!picks.includes(name)) picks.push(name);
      window.localStorage.setItem(PENDING_TREND_PICKS_KEY, JSON.stringify(picks));
    } catch {
      // Best-effort only — still navigate even if localStorage is unavailable.
    }
    setAdded(true);
  }

  if (added) {
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push("/dashboard/fitmap")}>
        Added ✓ — go to Founder Fit Map →
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={add}>
      + Add to my Founder Fit Map
    </button>
  );
}
