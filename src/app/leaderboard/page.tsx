"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { LeaderboardRankings } from "@/components/ui/leaderboard-rankings";

type Entry = {
  rank: number;
  name: string;
  image: string;
  points: number;
  spots: number;
  streak: number;
  bestCar: string;
  bestValue: number;
};

function badgeFor(spots: number): string {
  if (spots >= 100) return "🏆";
  if (spots >= 30) return "🥇";
  if (spots >= 15) return "🥈";
  if (spots >= 5) return "🥉";
  return "🚗";
}

function fmtUsd(n: number): string {
  if (!n || n <= 0) return "";
  return "$" + Math.round(n).toLocaleString("en-US");
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bestCar, setBestCar] = useState<{ name: string; car: string; value: number } | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        setEntries(Array.isArray(d.entries) ? d.entries : []);
        setBestCar(d.bestCar ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight">🏆 Leaderboard</h1>
        <p className="mt-1 text-muted-foreground">
          Ranked by points 🔥 — keep a daily streak to earn bonus points per spot.
        </p>

        {bestCar && (
          <div className="mt-6 rounded-3xl border border-amber-400/40 bg-gradient-to-b from-amber-400/10 to-card p-5 backdrop-blur-xl">
            <div className="text-xs font-bold uppercase tracking-wide text-amber-300">🚗 Best car spotted</div>
            <div className="mt-1 text-xl font-extrabold">{bestCar.car}</div>
            <div className="text-sm text-muted-foreground">
              by {bestCar.name}
              {bestCar.value > 0 ? ` · worth ${fmtUsd(bestCar.value)}` : ""}
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-6 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mt-6 rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6 text-center">
            <h3 className="text-lg font-bold">Leaderboard is being set up</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The global leaderboard needs its database connected and sign-in enabled. Check back soon!
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/[0.06] bg-card p-6 text-center backdrop-blur-xl">
            <h3 className="text-lg font-bold">No spotters yet 🏁</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in and start identifying cars to claim the #1 spot.
            </p>
          </div>
        ) : (
          <LeaderboardRankings
            className="mt-6"
            showPagination={entries.length > 10}
            rankings={entries.map((e) => ({
              userId: `${e.rank}-${e.name}`,
              userName: `${badgeFor(e.spots)} ${e.name}`,
              rank: e.rank,
              value: e.points,
              byline: [
                e.streak > 0 ? `🔥 ${e.streak}d streak` : null,
                `${e.spots} spots`,
                e.bestCar ? `Best: ${e.bestCar}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              avatarUrl: e.image || null,
            }))}
          />
        )}
      </main>
    </>
  );
}
