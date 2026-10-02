"use client";

import { useEffect, useState } from "react";
import { WANTED, HUNT_RULE, getHunt, joinHunt, totalEarned, type HuntState } from "@/lib/hunt";
import { Trophy, Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui/editorial";
import { MemberGate } from "@/components/member-gate";
import { cn } from "@/lib/utils";
import { ThinkingOrb } from "thinking-orbs";

const money = (n: number) => "$" + n.toLocaleString("en-US");
const count = (n: number) => n.toLocaleString("en-US");

type Status = {
  configured: boolean;
  count: number;
  goal: number;
  entered: boolean;
  started: boolean;
};

/** Rarity band. A word now — the tiers used to be three colour schemes. */
function tierLabel(bounty: number): string {
  if (bounty >= 800) return "Legendary";
  if (bounty >= 400) return "Epic";
  return "Rare";
}

export default function HuntPage() {
  return (
    <MemberGate
      tier="max"
      title="Car Hunt Miami"
      blurb="A real-money scavenger hunt for the world's rarest cars."
      points={[
        "A wanted board of rare cars, each with a cash bounty.",
        "Spot a wanted car in the wild and claim its bounty — the biggest are worth hundreds.",
        "Verified winners get paid out through CashApp.",
      ]}
    >
      <HuntInner />
    </MemberGate>
  );
}

function HuntInner() {
  const [hunt, setHunt] = useState<HuntState | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [joining, setJoining] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Deferred off the effect body: a synchronous state write there cascades
    // renders, which this project lints against.
    let cancelled = false;
    Promise.resolve()
      .then(() => getHunt())
      .then((h) => {
        if (!cancelled) setHunt(h);
      })
      .catch(() => {});

    fetch("/api/hunt/enter", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Status) => {
        if (!cancelled && typeof d.count === "number") setStatus(d);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Entering the hunt.
   *
   * Held on screen for a minimum beat rather than however long the request
   * happens to take. Joining is the one irreversible thing on this page, and a
   * button that simply flips state gives no sense that anything was committed —
   * the wait is what makes it feel like being entered into something.
   *
   * The floor and the request run together, so a slow network is not the floor
   * plus the request: whichever takes longer is what you wait for.
   */
  async function enter() {
    if (joining) return;
    setJoining(true);
    setError("");
    const floor = new Promise((r) => setTimeout(r, 1500));
    try {
      const request = (async () => {
        const res = await fetch("/api/hunt/enter", { method: "POST" });
        return { ok: res.ok, d: await res.json() };
      })();
      const [, result] = await Promise.all([floor, request]);
      if (!result.ok) {
        setError(result.d.error || "Couldn't enter the hunt.");
        return;
      }
      setStatus(result.d);
      setHunt(joinHunt()); // this device's own board state
    } catch {
      await floor; // a failure should not snap back faster than a success
      setError("Network error — you weren't entered.");
    } finally {
      setJoining(false);
    }
  }

  if (joining) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-black/85 backdrop-blur-xl"
      >
        <ThinkingOrb state="connecting" size={64} theme="dark" aria-label="" />
        <div className="text-center">
          <p className="display text-2xl">Entering the hunt</p>
          <p className="mt-2 text-[15px] opacity-60">Putting your name on the board…</p>
        </div>
      </div>
    );
  }

  const earned = hunt ? totalEarned(hunt) : 0;
  const found = hunt ? Object.keys(hunt.claimed).length : 0;

  const entered = !!status?.entered || !!hunt?.joined;
  const started = !!status?.started;
  const goal = status?.goal ?? 1000;
  const entrants = status?.count ?? 0;
  const pct = Math.min(100, Math.round((entrants / Math.max(1, goal)) * 100));

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-6">
      <header className="flex h-14 items-center justify-between">
        <h1 className="text-[34px] font-bold tracking-tight text-white">Hunt</h1>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="press min-h-11 rounded-full border border-[var(--line-button)] bg-[var(--color-surface)] px-4 text-[14px] font-semibold text-white"
        >
          How it works
        </button>
      </header>

      {/* Two stat cards. "N active" rather than "N nearby": there is no
          location on a wanted car, so nothing here knows what is near you, and
          the spec's own fallback is the active count. */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-card border border-[var(--line-card)] bg-[var(--color-surface)] p-4">
          <Crosshair className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden />
          <div className="mt-3 text-[17px] font-semibold text-white">Active Hunts</div>
          <div className="mt-0.5 text-[14px] text-[var(--color-secondary-text)]">
            {WANTED.length - found} active
          </div>
        </div>
        <div className="rounded-card border border-[var(--line-card)] bg-[var(--color-surface)] p-4">
          <Trophy className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden />
          <div className="mt-3 text-[17px] font-semibold text-white">Your Rewards</div>
          <div className="mt-0.5 text-[14px] text-[var(--color-secondary-text)]">
            {money(earned)} earned
          </div>
        </div>
      </div>

      {/* Entering, and how close the hunt is to starting. Kept from the old
          header: it is the only control on this screen that does anything, and
          the mockup has nowhere for it. */}
      <section className="mt-5 rounded-card border border-[var(--line-card)] bg-[var(--color-surface)] p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[20px] font-bold tabular-nums text-white">
            {status ? count(entrants) : "—"}
          </span>
          <span className="text-[14px] text-[var(--color-secondary-text)]">
            of {count(goal)} hunters
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[14px] text-[var(--color-secondary-text)]">
          {started
            ? "The hunt is live."
            : `The hunt starts once ${count(goal)} hunters have entered.`}
        </p>

        {entered ? (
          started ? (
            <Button href="/hunt/spot" className="mt-4 w-full">Start hunting</Button>
          ) : (
            <p className="mt-4 text-[14px] text-[var(--color-secondary-text)]">
              You&apos;re in — waiting on the rest.
            </p>
          )
        ) : (
          <Button onClick={enter} loading={joining} className="mt-4 w-full">
            Enter the hunt
          </Button>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[14px] text-error">
            {error}
          </p>
        )}
        {status && !status.configured && (
          <p className="mt-3 text-[14px] text-[var(--color-secondary-text)]">
            Entries aren&apos;t connected yet, so the counter can&apos;t be read.
          </p>
        )}
      </section>

      {/* Wanted board */}
      <h2 className="util-label mt-10 text-center opacity-60">Wanted board</h2>

      <div className="mt-4 space-y-2.5">
        {WANTED.map((w, i) => {
          const claimed = !!hunt?.claimed[w.id];
          return (
            <div
              key={w.id}
              className={cn(
                "glass-card flex items-center gap-3 rounded-card p-3.5",
                claimed && "opacity-60",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold tabular-nums">
                {i + 1}
              </span>

              <span
                className="h-6 w-6 shrink-0 rounded-full border border-[var(--line-button)]"
                style={{
                  background:
                    // A real car colour is a real colour and stays one -- the swatch is
                    // what the hunt is asking you to find. Only the "any colour"
                    // fallback loses its rainbow, which was decoration.
                    w.swatch ?? "#1a1a1a",
                }}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-semibold", claimed && "line-through")}>{w.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="util-label opacity-60">
                    {claimed ? "Claimed" : tierLabel(w.bounty)}
                  </span>
                  <span className="util-label rounded bg-white/[0.06] px-1.5 py-0.5 opacity-70">
                    {w.colorLabel}
                  </span>
                </div>
              </div>

              <span className="shrink-0 text-base font-bold tabular-nums">{money(w.bounty)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-1 text-center">
        <p className="text-[14px] text-[var(--color-secondary-text)]">{HUNT_RULE}</p>
        <p className="util-label opacity-50">
          Each car must be the exact colour shown (except any-colour).
        </p>
        <p className="util-label opacity-50">
          Spot it live in the Hunt camera — camera roll doesn&apos;t count.
        </p>
      </div>
      {rulesOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="How the hunt works"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70"
          onClick={() => setRulesOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-t-sheet border-t border-[var(--line-card)] bg-[var(--color-surface)] px-5 pb-10 pt-3"
          >
            {/* Grabber, then the rules. The text is the app's own HUNT_RULE
                plus the three steps the feature actually implements -- nothing
                here describes a rule the code does not enforce. */}
            <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-white/25" />
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-white">How it works</h2>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                aria-label="Close"
                className="press flex h-11 w-11 items-center justify-center rounded-full"
              >
                <X className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <ol className="mt-3 space-y-3 text-[15px] leading-relaxed text-white">
              <li>1. Pick a car off the wanted board below.</li>
              <li>2. Spot it out on the road and photograph it with the hunt camera.</li>
              <li>3. If it matches, claim its bounty and get paid.</li>
            </ol>
            <p className="mt-4 text-[14px] text-[var(--color-secondary-text)]">{HUNT_RULE}</p>
          </div>
        </div>
      )}

    </main>
  );
}
