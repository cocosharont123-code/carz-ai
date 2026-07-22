"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { WANTED, HUNT_RULE, getHunt, joinHunt, totalEarned, type HuntState } from "@/lib/hunt";
import { Button, LiveDot } from "@/components/ui/editorial";

const money = (n: number) => "$" + n.toLocaleString("en-US");

function tierLabel(bounty: number) {
  if (bounty >= 800) return { cls: "hunt-legendary", label: "Legendary" };
  if (bounty >= 400) return { cls: "hunt-epic", label: "Epic" };
  return { cls: "hunt-rare", label: "Rare" };
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
        {/* Hero */}
        <div className="hunt-banner rounded-3xl p-[1.5px]">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-black px-6 py-8 text-center">
            <div className="text-4xl">🏁</div>
            <h1 className="display mt-2 text-6xl sm:text-7xl">Car Hunt Miami</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-nred">
              Hit the streets and spot the world&apos;s rarest cars. Find one on the wanted board and cash
              the bounty.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 util-label text-nblue">
              Starts August 25 · 11:00 AM ET
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-white/10 px-4 py-1 util-label text-nred">
                Pot {money(totalPot)}
              </span>
              <span className="rounded-full border border-white/10 px-4 py-1 util-label text-nred">
                On the road only
              </span>
            </div>

            {joined ? (
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 util-label text-nblue">
                    <LiveDot /> {money(earned)} earned
                  </span>
                  <span className="rounded-full border border-white/15 px-3 py-1 util-label text-nblue">
                    {found}/{WANTED.length} found
                  </span>
                </div>
                <Button href="/hunt/spot" size="lg" className="hunt-glow">
                  Start hunting
                </Button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-2">
                <Button onClick={() => setHunt(joinHunt())} size="lg" className="hunt-glow">
                  Join hunt
                </Button>
                <p className="util-label text-ngreen">Join the hunt to earn rewards.</p>
              </div>
            )}
          </div>
        </div>

        {/* Wanted board */}
        <h2 className="display mt-8 text-2xl">Wanted board</h2>
        <div className="mt-3 space-y-2.5">
          {WANTED.map((w, i) => {
            const t = tierLabel(w.bounty);
            const claimed = !!hunt?.claimed[w.id];
            return (
              <div
                key={w.id}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                  claimed ? "border-white/40 bg-white/10" : t.cls
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    i < 3 ? "bg-white text-black" : "border border-white/20 text-nred"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="text-3xl grayscale">{w.emoji}</div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-bold text-nblue ${claimed ? "line-through opacity-60" : ""}`}>
                    {w.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="util-label text-ngreen">{claimed ? "✓ Claimed" : t.label}</span>
                    <span className="rounded border border-white/10 px-1.5 py-0.5 util-label text-nred">
                      {w.colorLabel}
                    </span>
                  </div>
                </div>
                <div className="display shrink-0 text-2xl text-nblue">{money(w.bounty)}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 space-y-1 text-center">
          <p className="util-label text-ngreen">{HUNT_RULE}</p>
          <p className="util-label text-ngreen">Each car must be the exact color shown (except any-color).</p>
          <p className="util-label text-ngreen">Spot it live in the Hunt camera — camera roll doesn&apos;t count.</p>
        </div>
      </main>
    </>
  );
}
