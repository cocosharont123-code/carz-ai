"use client";

import { useEffect, useState } from "react";
import { WANTED, HUNT_RULE, getHunt, joinHunt, totalEarned, type HuntState } from "@/lib/hunt";
import { Button, LiveDot } from "@/components/ui/editorial";
import { MemberGate } from "@/components/member-gate";
import { cn } from "@/lib/utils";

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

  async function enter() {
    if (joining) return;
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/hunt/enter", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Couldn't enter the hunt.");
        return;
      }
      setStatus(d);
      setHunt(joinHunt()); // this device's own board state
    } catch {
      setError("Network error — you weren't entered.");
    } finally {
      setJoining(false);
    }
  }

  const earned = hunt ? totalEarned(hunt) : 0;
  const found = hunt ? Object.keys(hunt.claimed).length : 0;
  const totalPot = WANTED.reduce((t, w) => t + w.bounty, 0);

  const entered = !!status?.entered || !!hunt?.joined;
  const started = !!status?.started;
  const goal = status?.goal ?? 1000;
  const entrants = status?.count ?? 0;
  const pct = Math.min(100, Math.round((entrants / Math.max(1, goal)) * 100));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      {/* Heading */}
      <header className="glass-card rounded-3xl px-6 py-10 text-center">
        <h1 className="display text-6xl leading-none sm:text-7xl">Hunt</h1>
        <p className="util-label mt-2 opacity-60">Carz AI</p>

        <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed opacity-70">
          Spot one of the cars on the wanted board out on the road and claim its bounty.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="util-label rounded-full bg-white/[0.06] px-4 py-1.5">
            Pot {money(totalPot)}
          </span>
          <span className="util-label rounded-full bg-white/[0.06] px-4 py-1.5">
            On the road only
          </span>
        </div>

        {/* How many are in, and how many it takes to start. */}
        <div className="mx-auto mt-7 max-w-sm">
          <div className="flex items-baseline justify-between">
            <span className="display text-3xl tabular-nums">
              {status ? count(entrants) : "—"}
            </span>
            <span className="util-label opacity-60">of {count(goal)} hunters</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/70 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs opacity-60">
            {started
              ? "The hunt is live."
              : `The hunt starts once ${count(goal)} hunters have entered.`}
          </p>
        </div>

        {entered ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              <span className="util-label flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1">
                <LiveDot /> {money(earned)} earned
              </span>
              <span className="util-label rounded-full bg-white/[0.06] px-3 py-1">
                {found}/{WANTED.length} found
              </span>
            </div>
            {started ? (
              <Button href="/hunt/spot" size="lg">Start hunting</Button>
            ) : (
              <p className="util-label opacity-60">You&apos;re in — waiting on the rest.</p>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button onClick={enter} loading={joining} size="lg">Enter the hunt</Button>
            <p className="util-label opacity-60">Entering reserves your place.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-neon-red">
            {error}
          </p>
        )}
        {status && !status.configured && (
          <p className="mt-3 text-xs opacity-60">
            Entries aren&apos;t connected yet, so the counter can&apos;t be read.
          </p>
        )}
      </header>

      {/* Wanted board */}
      <h2 className="util-label mt-10 text-center opacity-60">Wanted board</h2>

      <div className="mt-4 space-y-2.5">
        {WANTED.map((w, i) => {
          const claimed = !!hunt?.claimed[w.id];
          return (
            <div
              key={w.id}
              className={cn(
                "glass-card flex items-center gap-3 rounded-2xl p-3.5",
                claimed && "opacity-60",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold tabular-nums">
                {i + 1}
              </span>

              <span
                className="h-6 w-6 shrink-0 rounded-full border border-white/25"
                style={{
                  background:
                    w.swatch ?? "conic-gradient(#ef4444,#facc15,#22c55e,#3b82f6,#ef4444)",
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
        <p className="util-label opacity-50">{HUNT_RULE}</p>
        <p className="util-label opacity-50">
          Each car must be the exact colour shown (except any-colour).
        </p>
        <p className="util-label opacity-50">
          Spot it live in the Hunt camera — camera roll doesn&apos;t count.
        </p>
      </div>
    </main>
  );
}
