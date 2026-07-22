"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { WANTED, getHunt, joinHunt, totalEarned, type HuntState } from "@/lib/hunt";

const money = (n: number) => "$" + n.toLocaleString("en-US");

function tier(bounty: number) {
  if (bounty >= 800) return { cls: "hunt-legendary", pill: "from-amber-400 to-orange-500", label: "🔥 LEGENDARY", text: "text-amber-300" };
  if (bounty >= 400) return { cls: "hunt-epic", pill: "from-fuchsia-500 to-violet-600", label: "💜 EPIC", text: "text-fuchsia-300" };
  return { cls: "hunt-rare", pill: "from-sky-400 to-cyan-500", label: "💎 RARE", text: "text-sky-300" };
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
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-8">
        {/* Animated Miami banner */}
        <div className="hunt-banner relative overflow-hidden rounded-3xl p-[2px]">
          <div className="rounded-[calc(1.5rem-2px)] bg-background/55 px-6 py-7 text-center backdrop-blur-xl">
            <div className="text-5xl drop-shadow-[0_0_12px_rgba(255,0,110,0.6)]">🌴🏁🌆</div>
            <h1 className="mt-2 bg-gradient-to-r from-amber-300 via-fuchsia-400 to-sky-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
              CAR HUNT MIAMI
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium text-foreground/90">
              Hit the streets and spot the world&apos;s rarest cars. Find one on the wanted board and
              <span className="font-bold text-amber-300"> cash the bounty.</span>
            </p>
            <div className="mt-3 inline-block rounded-full bg-black/40 px-4 py-1 text-sm font-bold">
              💰 Total pot: <span className="text-amber-300">{money(totalPot)}</span>
            </div>

            {joined ? (
              <div className="mt-5 flex flex-col items-center gap-3">
                <div className="flex gap-3 text-sm">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-bold text-emerald-300">
                    💵 {money(earned)} earned
                  </span>
                  <span className="rounded-full bg-sky-500/20 px-3 py-1 font-bold text-sky-300">
                    🎯 {found}/{WANTED.length}
                  </span>
                </div>
                <Link
                  href="/hunt/spot"
                  className="hunt-glow rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 px-8 py-3.5 text-lg font-black text-white transition hover:scale-[1.03]"
                >
                  📸 START HUNTING
                </Link>
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  onClick={() => setHunt(joinHunt())}
                  className="hunt-glow rounded-2xl bg-white px-10 py-3.5 text-lg font-black text-[#1f1f1f] transition hover:scale-[1.03]"
                >
                  🏁 JOIN HUNT
                </button>
                <p className="text-xs font-medium text-foreground/80">
                  You must join the hunt to earn rewards.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Wanted board */}
        <div className="mt-7 flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          <h2 className="bg-gradient-to-r from-fuchsia-400 to-amber-300 bg-clip-text text-lg font-black uppercase tracking-widest text-transparent">
            Wanted Board
          </h2>
          <span className="text-2xl">⭐</span>
        </div>

        <div className="mt-3 space-y-2.5">
          {WANTED.map((w, i) => {
            const t = tier(w.bounty);
            const claimed = !!hunt?.claimed[w.id];
            return (
              <div
                key={w.id}
                className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3.5 transition hover:scale-[1.01] ${
                  claimed ? "border-emerald-500/50 bg-emerald-500/10" : t.cls
                }`}
              >
                {/* rank medallion */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    i === 0
                      ? "bg-gradient-to-br from-amber-300 to-orange-500 text-black"
                      : i === 1
                        ? "bg-gradient-to-br from-slate-200 to-slate-400 text-black"
                        : i === 2
                          ? "bg-gradient-to-br from-orange-300 to-amber-700 text-black"
                          : "bg-foreground/10 text-foreground/70"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="text-3xl drop-shadow">{w.emoji}</div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-black ${claimed ? "text-emerald-300 line-through" : ""}`}>
                    {w.name}
                  </p>
                  <p className={`text-[11px] font-bold uppercase tracking-wide ${claimed ? "text-emerald-400" : t.text}`}>
                    {claimed ? "✓ Claimed" : t.label}
                  </p>
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

        <p className="mt-5 text-center text-xs text-muted-foreground">
          🔒 Rewards are claimed by spotting the car <span className="font-semibold">live</span> in the Hunt
          camera — camera-roll photos don&apos;t count.
        </p>
      </main>
    </>
  );
}
