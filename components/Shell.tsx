"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { sendMentorMessage } from "@/lib/actions";

// Grouped to match the standalone prototype's Overview / Journey / Institution / Product
// sidebar sections — flat 18-item lists are harder to scan than labelled groups.
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Home", icon: "◆" },
      { href: "/dashboard/map", label: "Founder World", icon: "🗺" },
      { href: "/dashboard/guide", label: "Guide", icon: "🧭" },
    ],
  },
  {
    label: "Journey",
    items: [
      { href: "/dashboard/fitmap", label: "Self Discovery", icon: "①" },
      { href: "/dashboard/opportunities", label: "Opportunity Forest", icon: "②" },
      { href: "/dashboard/arena", label: "Idea Arena", icon: "③" },
      { href: "/dashboard/evidence", label: "Evidence & Market", icon: "④" },
      { href: "/dashboard/rivals", label: "Rival Radar", icon: "⑤" },
      { href: "/dashboard/trends", label: "Trend Radar", icon: "⑥" },
      { href: "/dashboard/validation", label: "Validation Quest Lab", icon: "⑦" },
      { href: "/dashboard/comparables", label: "Comparable Outcomes", icon: "⑪" },
      { href: "/dashboard/money", label: "Money Lab", icon: "⑧" },
      { href: "/dashboard/plan", label: "Business Plan", icon: "⑫" },
      { href: "/dashboard/dpr", label: "India Ledger", icon: "⑬" },
      { href: "/dashboard/ecosystem", label: "Investor Ecosystem", icon: "⑭" },
      { href: "/dashboard/passport", label: "Evidence Passport", icon: "⑨" },
      { href: "/dashboard/launch", label: "India Launch Pack", icon: "⑩" },
    ],
  },
  {
    label: "Institution",
    items: [
      { href: "/dashboard/institution", label: "Institution / Cohort", icon: "⑮" },
      { href: "/dashboard/mentors", label: "Mentors", icon: "⑯" },
    ],
  },
  {
    label: "Product",
    items: [
      { href: "/dashboard/pricing", label: "Plans", icon: "₹" },
      { href: "/dashboard/privacy", label: "Privacy & Consent", icon: "🔒" },
    ],
  },
];

const LENSES = ["Coach", "Teacher", "Operator", "Challenger"] as const;

export default function Shell({ userName, ageBand, children }: { userName: string; ageBand: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [railOpen, setRailOpen] = useState(false);
  // Theme starts "system" on the server render; the persisted choice (if any) is
  // applied after mount so server and client markup match on first paint.
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [mentorOpen, setMentorOpen] = useState(false);
  const [lens, setLens] = useState<(typeof LENSES)[number]>("Coach");
  // Fix: the fixed-position mentor widget's lens-picker row previously
  // always rendered, which meant it could collide with in-flow page
  // content whenever a page ended near the bottom-right corner (e.g. the
  // last field on Self Discovery). Collapsing it to a single button by
  // default — expanding only on hover/focus — keeps its footprint small
  // enough to stop overlapping real form fields.
  const [mentorWidgetExpanded, setMentorWidgetExpanded] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "mentor"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const mentorPanelRef = useRef<HTMLElement | null>(null);
  const mentorOpenButtonRef = useRef<HTMLButtonElement | null>(null);

  // Read the persisted theme once on mount (fix: theme previously reset on every reload).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("zcubs-theme");
      if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to "system" silently.
    }
  }, []);

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("zcubs-theme", theme);
    } catch {
      // Best-effort persistence only.
    }
  }, [theme]);

  // Mentor drawer: Escape to close, focus moves into the panel on open and
  // returns to the opening control on close (fix: drawer previously had no
  // keyboard dismissal or focus management).
  useEffect(() => {
    if (!mentorOpen) return;
    const panel = mentorPanelRef.current;
    const focusable = panel?.querySelector<HTMLElement>("input, button, textarea, [tabindex]");
    focusable?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMentorOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const openButton = mentorOpenButtonRef.current;
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openButton?.focus();
    };
  }, [mentorOpen]);

  useEffect(() => {
    if (mentorOpen && messages.length === 0) {
      setMessages([{ role: "mentor", content: "Loading your current session state…" }]);
      sendMentorMessage(lens, "(opened mentor panel)").then((reply) => {
        setMessages([{ role: "mentor", content: reply }]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorOpen]);

  function switchLens(l: (typeof LENSES)[number]) {
    setLens(l);
    setMessages([]);
    setMentorOpen(true);
  }

  async function send() {
    const v = input.trim();
    if (!v) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: v }]);
    setSending(true);
    const reply = await sendMentorMessage(lens, v);
    setMessages((m) => [...m, { role: "mentor", content: reply }]);
    setSending(false);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Fix: the nav column track used to be reserved (280px) even on mobile,
          where the nav itself is `hidden`, wasting layout width. Now the grid
          only reserves the rail column at md+ breakpoints. */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
        <header
          className="flex flex-wrap items-center gap-4 px-5 py-3 border-b sticky top-0 z-40"
          style={{ gridColumn: "1 / 3", borderColor: "var(--line)", background: "var(--bg-raise)" }}
        >
          <button className="btn btn-ghost btn-sm md:hidden" onClick={() => setRailOpen((v) => !v)} aria-label="Menu">☰</button>
          <div className="flex items-center gap-2 font-display font-semibold text-[19px]">
            <span className="w-7 h-7 rounded-md grid place-items-center text-white font-bold" style={{ background: "linear-gradient(135deg,#4a41e0,#1c9b8e)" }}>Z</span>
            Z Cubs
          </div>
          <span className="badge badge-grey" style={{ fontSize: 15 }}>Signed in as {userName} · {ageBand}</span>
          <div className="flex-1 min-w-2" />
          <button className="btn btn-ghost btn-sm" onClick={() => setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system")}>
            Theme: {theme[0].toUpperCase() + theme.slice(1)}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>Log out</button>
        </header>

        <nav
          className={`border-r overflow-y-auto p-3 ${railOpen ? "block" : "hidden"} md:block`}
          style={{ borderColor: "var(--line)", background: "var(--bg-raise)", position: "sticky", top: 57, height: "calc(100vh - 57px)" }}
        >
          {NAV_GROUPS.map((group) => {
            return (
              <div className="mb-4" key={group.label}>
                <div
                  className="font-mono uppercase px-2.5 pb-2"
                  style={{ fontSize: 13, letterSpacing: "0.05em", color: "var(--text-faint)" }}
                >
                  {group.label}
                </div>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setRailOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[18px] font-medium"
                        style={
                          active
                            ? { background: "var(--accent-grad)", color: "#fff", boxShadow: "var(--shadow-pop)" }
                            : { color: "var(--text-dim)" }
                        }
                      >
                        <span style={{ width: 18, textAlign: "center" }}>{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <main className="px-6 py-7 pb-20 max-w-[1320px] w-full mx-auto">{children}</main>
      </div>

      <div
        style={{
          position: "fixed",
          right: "max(22px, env(safe-area-inset-right))",
          bottom: "max(22px, env(safe-area-inset-bottom))",
          zIndex: 60,
        }}
        className="flex flex-col items-end gap-2"
        onMouseEnter={() => setMentorWidgetExpanded(true)}
        onMouseLeave={() => setMentorWidgetExpanded(false)}
        onFocus={() => setMentorWidgetExpanded(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setMentorWidgetExpanded(false);
        }}
      >
        {(mentorWidgetExpanded || mentorOpen) && (
          <div className="flex gap-1 mb-1">
            {LENSES.map((l) => (
              <button
                key={l}
                onClick={() => switchLens(l)}
                className="btn btn-ghost btn-sm"
                style={{
                  background: "var(--surface)", boxShadow: "var(--shadow)",
                  ...(lens === l && mentorOpen ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        <button
          ref={mentorOpenButtonRef}
          className="btn btn-primary"
          onClick={() => setMentorOpen((v) => !v)}
          aria-expanded={mentorOpen}
          aria-controls="mentor-drawer"
          aria-label={`Open mentor, ${lens} lens`}
          title={`Lens: ${lens} — hover for other lenses`}
          style={
            mentorWidgetExpanded || mentorOpen
              ? { transition: "padding .15s ease" }
              : { width: 50, height: 50, padding: 0, justifyContent: "center", borderRadius: "50%", fontSize: 20 }
          }
        >
          {mentorWidgetExpanded || mentorOpen ? (
            <>✦ Mentor <span className="font-mono-plex">{lens}</span></>
          ) : (
            <span aria-hidden="true">✦</span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {mentorOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMentorOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(10,12,20,.4)", zIndex: 65 }}
            />
            <motion.aside
              id="mentor-drawer"
              ref={mentorPanelRef as any}
              role="dialog"
              aria-modal="true"
              aria-label={`Mentor conversation, ${lens} lens`}
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 440, maxWidth: "92vw", background: "var(--bg-raise)", borderLeft: "1px solid var(--line)", zIndex: 70, display: "flex", flexDirection: "column" }}
            >
              <div className="p-4 border-b flex items-start justify-between gap-2" style={{ borderColor: "var(--line)" }}>
                <div>
                  <div className="eyebrow">Persistent founder mentor</div>
                  <h3 className="font-display text-[19px] mt-1">Talking to Kaya · {lens} lens</h3>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setMentorOpen(false)} aria-label="Close mentor panel">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className="max-w-[88%] px-3.5 py-2.5 rounded-xl text-[18px]"
                    style={m.role === "mentor"
                      ? { background: "var(--surface)", border: "1px solid var(--line)", alignSelf: "flex-start", borderBottomLeftRadius: 4 }
                      : { background: "var(--accent)", color: "#fff", alignSelf: "flex-end", borderBottomRightRadius: 4 }}
                  >
                    {m.content}
                  </div>
                ))}
                {sending && <p style={{ color: "var(--text-faint)" }}>Kaya is thinking…</p>}
              </div>
              <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--line)" }}>
                <input
                  className="field-input"
                  placeholder="Ask about your venture…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button className="btn btn-primary btn-sm" onClick={send}>Send</button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="border-t px-5 py-2.5 text-center" style={{ borderColor: "var(--line)", background: "var(--bg-raise)", fontSize: 16, color: "var(--text-faint)" }}>
        Z Cubs provides business education and decision support. It does not guarantee financial returns, business success, funding, legal compliance or investor acceptance.
      </div>
    </div>
  );
}
