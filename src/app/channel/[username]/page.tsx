"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChannelHeader } from "@/components/channel/channel-header";

/**
 * Somebody's profile.
 *
 * It used to be a grid of their clips over a header, which is what a channel was
 * for. The feed is gone, so what is left is who they are, their following and
 * the follow button -- all of which came from the profile and follow stores, not
 * from the feed, and all of which still work.
 */

type Channel = {
  username: string;
  displayName: string;
  image: string;
  bio: string;
  cover: string;
  member: boolean;
  isYou: boolean;
};

type Stats = { followers: number; following: number; youFollow: boolean };

export default function ChannelPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const handle = decodeURIComponent(username).replace(/^@/, "");

  const [channel, setChannel] = useState<Channel | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/channel/${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setMissing(true);
          return;
        }
        setChannel(data.channel);
        setStats(data.stats);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) return <ChannelSkeleton />;

  if (missing || !channel) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-20 text-center">
        <h1 className="display text-[34px]">No such channel</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] opacity-60">
          Nobody here goes by @{handle}.
        </p>
        <Link
          href="/search"
          className="press mt-6 inline-flex min-h-11 items-center rounded-full bg-carz px-6 text-[14px] font-bold text-neutral-900"
        >
          Search for someone
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl pb-16">
      <ChannelHeader channel={channel} stats={stats} onStats={setStats} />
    </main>
  );
}

/** Shaped like the real thing, so nothing jumps when it arrives. */
function ChannelSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl pb-16" aria-busy="true">
      <div className="h-36 w-full animate-pulse bg-foreground/[0.06] sm:h-44" />
      <div className="px-5">
        <div className="-mt-10 h-20 w-20 animate-pulse glass-chip rounded-full ring-4 ring-black" />
        <div className="mt-3 h-5 w-40 animate-pulse rounded bg-foreground/[0.06]" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-foreground/[0.05]" />
        <div className="mt-4 h-3 w-full max-w-sm animate-pulse rounded bg-foreground/[0.05]" />
        <div className="mt-5 flex gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 w-14 animate-pulse rounded bg-foreground/[0.05]" />
          ))}
        </div>
        <div className="mt-5 h-10 w-full animate-pulse glass-chip rounded-full" />
      </div>
    </main>
  );
}
