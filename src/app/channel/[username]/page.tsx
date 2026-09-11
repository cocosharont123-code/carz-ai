"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChannelHeader } from "@/components/channel/channel-header";
import { VideoGrid } from "@/components/channel/video-grid";
import type { FeedPostView } from "@/components/feed/post-card";

type Channel = {
  username: string;
  displayName: string;
  image: string;
  bio: string;
  cover: string;
  member: boolean;
  isYou: boolean;
};

type Stats = { followers: number; following: number; youFollow: boolean; posts: number };

export default function ChannelPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const handle = decodeURIComponent(username).replace(/^@/, "");

  const router = useRouter();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<FeedPostView[]>([]);
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
        setPosts(data.posts ?? []);
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

  /** A thumbnail opens the feed on that video rather than a page of its own. */
  const openAt = useCallback(
    (postId: string) => router.push(`/feed?start=${encodeURIComponent(postId)}`),
    [router],
  );

  if (loading) return <ChannelSkeleton />;

  if (missing || !channel) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-20 text-center">
        <h1 className="display text-3xl">No such channel</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] opacity-60">
          Nobody here goes by @{handle}.
        </p>
        <Link
          href="/feed"
          className="press mt-6 inline-flex rounded-full bg-white px-6 py-2.5 text-sm font-bold text-neutral-900"
        >
          Back to the feed
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl pb-16">
      <ChannelHeader channel={channel} stats={stats} onStats={setStats} />
      <VideoGrid posts={posts} onOpen={openAt} />
    </main>
  );
}

/** Shaped like the real thing, so nothing jumps when it arrives. */
function ChannelSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl pb-16" aria-busy="true">
      <div className="h-36 w-full animate-pulse bg-white/[0.06] sm:h-44" />
      <div className="px-5">
        <div className="-mt-10 h-20 w-20 animate-pulse rounded-full bg-white/[0.08] ring-4 ring-black" />
        <div className="mt-3 h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
        <div className="mt-4 h-3 w-full max-w-sm animate-pulse rounded bg-white/[0.05]" />
        <div className="mt-5 flex gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 w-14 animate-pulse rounded bg-white/[0.05]" />
          ))}
        </div>
        <div className="mt-5 h-10 w-full animate-pulse rounded-full bg-white/[0.06]" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-[9/16] animate-pulse bg-white/[0.04]" />
        ))}
      </div>
    </main>
  );
}
