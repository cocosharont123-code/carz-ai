"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { WANTED, getHunt, joinHunt, totalEarned, type HuntState } from "@/lib/hunt";

const money = (n: number) => "$" + n.toLocaleString("en-US");

export default function HuntPage() {
  const [hunt, setHunt] = useState<HuntState | null>(null);

  useEffect(() => {
    setHunt(getHunt());
  }, []);

  function join() {
    setHunt(joinHunt());
  }

  const joined = !!hunt?.joined;
  const earned = hunt ? totalEarned(hunt) : 0;
  const found = hunt ? Object.keys(hunt.claimed).length : 0;
  const totalPot = WANTED.reduce((t, w) => t + w.bounty, 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-8">
        {/* Miami banner */}
        <div className="relative overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/25 via-orange-500/20 to-sky-500/25 p-6 text-center">
          <div className="text-4xl">🌴🏁</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Car Hunt Miami</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-foreground/80">
            Hit the streets of Miami and spot the world&apos;s rarest cars. Find one on the wanted
            board and claim its bounty. Total pot: <span className="font-bold">{money(totalPot)}</span>.
          </p>

          {joined ? (
            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="flex gap-4 text-sm">
                <span className="rounded-full bg-background/40 px-3 py-1">
                  💰 Earned <span className="font-bold">{money(earned)}</span>
                </span>
                <span className="rounded-full bg-background/40 px-3 py-1">
                  🎯 {found}/{WANTED.length} found
                </span>
              </div>
              <Link
                href="/hunt/spot"
                className="rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-500 px-6 py-3 font-black text-white shadow-lg transition hover:opacity-90"
              >
                📸 Start hunting
              </Link>
            </div>
          ) : (
            <button
              onClick={join}
              className="mt-5 rounded-xl bg-white px-8 py-3 font-black text-[#1f1f1f] shadow-lg transition hover:opacity-90"
            >
              Join Hunt
            </button>
          )}
          {!joined && (
            <p className="mt-2 text-xs text-foreground/70">You must join the hunt to earn rewards.</p>
          )}
        </div>

        {/* Wanted board */}
        <div className="mt-6">
          <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground">
            ⭐ Wanted board
          </h2>
          <div className="mt-3 space-y-2.5">
            {WANTED.map((w, i) => {
              const claimed = !!hunt?.claimed[w.id];
              return (
                <div
                  key={w.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                    claimed
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-foreground/[0.07] bg-card"
                  }`}
                >
                  <div className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</div>
                  <div className="text-2xl">{w.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-bold ${claimed ? "text-emerald-300 line-through" : ""}`}>{w.name}</p>
                    <p className="text-xs text-muted-foreground">{claimed ? "Claimed ✓" : "Wanted"}</p>
                  </div>
                  <div className={`shrink-0 text-lg font-black ${claimed ? "text-emerald-300" : "text-amber-300"}`}>
                    {money(w.bounty)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Rewards are claimed by spotting the car live in the Hunt camera — photos from your camera
            roll don&apos;t count.
          </p>
        </div>
      </main>
    </>
  );
}
