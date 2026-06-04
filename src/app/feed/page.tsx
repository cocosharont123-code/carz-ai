"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type Post = {
  id: string;
  userName: string;
  userImage: string;
  image: string;
  make: string;
  model: string;
  yearRange: string;
  caption: string;
  ts: number;
  likes: number;
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function FeedPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setLiked(JSON.parse(localStorage.getItem("cs_liked") || "{}"));
    } catch {}
    fetch("/api/feed")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        setPosts(Array.isArray(d.posts) ? d.posts : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function like(id: string) {
    if (liked[id]) return;
    const next = { ...liked, [id]: true };
    setLiked(next);
    localStorage.setItem("cs_liked", JSON.stringify(next));
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
    try {
      await fetch("/api/feed/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight">Spotted 🏎️</h1>
          <Link
            href="/spot"
            className="rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-4 py-2 text-sm font-bold text-white"
          >
            + Post a spot
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Cars spotted by the community.</p>

        {loading ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-3xl bg-white/[0.04]" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mt-6 rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6 text-center">
            <h3 className="text-lg font-bold">The feed is being set up</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The community feed needs its database connected. Check back soon!
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/[0.06] bg-card p-8 text-center backdrop-blur-xl">
            <div className="text-4xl">📷</div>
            <h3 className="mt-3 text-lg font-bold">No spots yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first — identify a car and post it to the feed.
            </p>
            <Link
              href="/spot"
              className="mt-4 inline-block rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-5 py-2.5 font-semibold text-white"
            >
              Spot a car
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {posts.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-3xl border border-white/[0.06] bg-card backdrop-blur-xl">
                <div className="flex items-center gap-3 p-3">
                  {p.userImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.userImage} alt="" className="h-9 w-9 rounded-full" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-sm font-bold">
                      {(p.userName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.userName}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(p.ts)} ago</div>
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={`${p.make} ${p.model}`} className="aspect-square w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => like(p.id)}
                      className={`text-2xl transition active:scale-90 ${liked[p.id] ? "" : "grayscale"}`}
                      aria-label="like"
                    >
                      ❤️
                    </button>
                    <span className="text-sm font-semibold">{p.likes}</span>
                  </div>
                  {(p.make || p.model) && (
                    <p className="mt-2 font-bold">
                      {p.make} {p.model}{" "}
                      <span className="font-normal text-muted-foreground">{p.yearRange}</span>
                    </p>
                  )}
                  {p.caption && <p className="mt-1 text-sm">{p.caption}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
