"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { WANTED, HUNT_RULE, getHunt, joinHunt, totalEarned, type HuntState } from "@/lib/hunt";
import { Button, LiveDot } from "@/components/ui/editorial";
import { MemberGate } from "@/components/member-gate";

const money = (n: number) => "$" + n.toLocaleString("en-US");

function tier(bounty: number) {
  if (bounty >= 800)
    return { cls: "hunt-legendary", label: "🔥 Legendary", text: "text-amber-300", pill: "from-amber-400 to-orange-500" };
  if (bounty >= 400)
    return { cls: "hunt-epic", label: "💜 Epic", text: "text-fuchsia-300", pill: "from-fuchsia-500 to-violet-600" };
  return { cls: "hunt-rare", label: "💎 Rare", text: "text-cyan-300", pill: "from-cyan-400 to-sky-500" };
}

export default function HuntPage() {
  const [hunt, setHunt] = useState<HuntState | null>(null);

  useEffect(() => {
    setHunt(getHunt());
  }, []);

  const joined = !!hunt?.joined;
  const earned = hunt ? totalEarned(hunt) : 0;
  const found = hunt ? Object.keys(hunt.claimed).length : 0;
  const totalPot = WANTED.reduce((t, w) => t + w.bounty, 0);

  return (
    <MemberGate
      icon="🏁"
      title="Car Hunt is members-only"
      blurb="Car Hunt Miami and its cash bounties are a Carz+ perk. Join to hit the neon streets and cash in."
    >
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-8">
        {/* Neon Miami hero */}
        <div className="hunt-banner rounded-3xl p-[2px] shadow-[0_0_50px_-12px_rgba(255,0,110,0.6)]">
          <div className="rounded-[calc(1.5rem-2px)] bg-black/85 px-6 py-9 text-center text-white">
            <div className="text-5xl drop-shadow-[0_0_16px_rgba(255,0,110,0.7)]">🌴🏁🌆</div>
            <h1 className="hunt-title display mt-3 text-6xl leading-none sm:text-7xl">Car Hunt Miami</h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-medium text-white/85">
              Hit the neon streets and spot the world&apos;s rarest cars. Find one on the wanted board and
              <span className="font-bold text-amber-300"> cash the bounty.</span>
            </p>

            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/15 px-4 py-1.5 util-label text-amber-200">
              🗓️ Starts August 25 · 11:00 AM ET
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-gradient-to-r from-fuchsia-500/25 to-violet-500/25 px-4 py-1 util-label text-fuchsia-200">
                💰 Pot {money(totalPot)}
              </span>
              <span className="rounded-full bg-gradient-to-r from-cyan-500/25 to-sky-500/25 px-4 py-1 util-label text-cyan-200">
                📍 On the road only
              </span>
            </div>

            {joined ? (
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 util-label text-emerald-300">
                    <LiveDot /> {money(earned)} earned
                  </span>
                  <span className="rounded-full bg-sky-500/20 px-3 py-1 util-label text-sky-300">
                    🎯 {found}/{WANTED.length}
                  </span>
                </div>
                <Button href="/hunt/spot" size="lg" className="hunt-glow bg-gradient-to-r from-fuchsia-500 to-orange-500 text-white">
                  📸 Start hunting
                </Button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-2">
                <Button onClick={() => setHunt(joinHunt())} size="lg" className="hunt-glow bg-gradient-to-r from-fuchsia-500 to-orange-500 text-white">
                  🏁 Join the hunt
                </Button>
                <p className="util-label text-white/60">Join to earn rewards.</p>
              </div>
            )}
          </div>
        </div>

        {/* Wanted board */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="text-2xl">⭐</span>
          <h2 className="hunt-title display text-2xl">Wanted Board</h2>
          <span className="text-2xl">⭐</span>
        </div>

        <div className="mt-4 space-y-2.5">
          {WANTED.map((w, i) => {
            const t = tier(w.bounty);
            const claimed = !!hunt?.claimed[w.id];
            return (
              <div
                key={w.id}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-white transition hover:scale-[1.01] ${
                  claimed ? "border-emerald-500/50 bg-emerald-500/10" : t.cls
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    i === 0
                      ? "bg-gradient-to-br from-amber-300 to-orange-500 text-black"
                      : i === 1
                        ? "bg-gradient-to-br from-slate-200 to-slate-400 text-black"
                        : i === 2
                          ? "bg-gradient-to-br from-orange-300 to-amber-700 text-black"
                          : "bg-white/10 text-white/70"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="text-3xl">{w.emoji}</div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-black ${claimed ? "text-emerald-300 line-through" : ""}`}>{w.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={`util-label ${claimed ? "text-emerald-400" : t.text}`}>
                      {claimed ? "✓ Claimed" : t.label}
                    </span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 util-label text-white/70">🎨 {w.colorLabel}</span>
                  </div>
                </div>
                <div
                  className={`shrink-0 rounded-xl bg-gradient-to-r px-3 py-1.5 text-base font-black text-white shadow-lg ${
                    claimed ? "from-emerald-500 to-teal-500" : t.pill
                  }`}
                >
                  {money(w.bounty)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 space-y-1 text-center">
          <p className="util-label text-fuchsia-300/80">{HUNT_RULE}</p>
          <p className="util-label text-cyan-300/80">Each car must be the exact color shown (except any-color).</p>
          <p className="util-label text-amber-300/80">Spot it live in the Hunt camera — camera roll doesn&apos;t count.</p>
        </div>
      </main>
    </MemberGate>
  );
}
