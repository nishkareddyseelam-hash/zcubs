"use client";
import { useState } from "react";

// D-020 (docs/DECISION_LOG.md): loads Razorpay's own Standard Checkout
// script on demand (never bundled/self-hosted — Razorpay requires the
// checkout flow itself to be served from their domain) and opens it for
// one specific plan. This component only ever shows the checkout UI and
// reports what Razorpay told the browser — it never grants the plan
// itself. The real upgrade happens when Razorpay's webhook reaches the
// server (src/lib/payments.ts) a few seconds later, which is why the
// success state below says "processing", not "upgraded".
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment form. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

export default function RazorpayCheckoutButton({ plan, label, priceInr }: { plan: string; label: string; priceInr: number }) {
  const [state, setState] = useState<"idle" | "loading" | "processing" | "error">("idle");
  const [error, setError] = useState("");

  async function startCheckout() {
    setState("loading");
    setError("");
    try {
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Could not start checkout.");

      await loadCheckoutScript();
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Z Cubs",
        description: `${label} plan`,
        order_id: order.orderId,
        handler: () => {
          // Real confirmation comes from Razorpay's webhook, not this
          // callback (a browser can't be trusted to self-report payment
          // success) — see src/lib/payments.ts.
          setState("processing");
        },
        modal: {
          ondismiss: () => setState("idle"),
        },
      });
      rzp.open();
      setState("idle");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong starting checkout.");
    }
  }

  if (state === "processing") {
    return (
      <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
        Payment received by Razorpay — your plan updates automatically within a few seconds once we confirm it. Refresh this page shortly to see it reflected.
      </p>
    );
  }

  return (
    <div>
      <button type="button" className="btn btn-primary btn-sm" onClick={startCheckout} disabled={state === "loading"}>
        {state === "loading" ? "Starting checkout…" : `Pay ₹${priceInr.toLocaleString("en-IN")} — upgrade`}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "var(--gap, #b3413a)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}
