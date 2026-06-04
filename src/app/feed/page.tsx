"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type Post = {
  id: string;
  username: string;
  displayName: string;
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

function Avatar({ post }: { post: Post }) {
  if (post.userImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.userImage} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-bold text-white">
      {(post.displayName || post.username || "?").charAt(0).toUpperCase()}
    </div>
  );
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
      <main className="mx-auto w-full max-w-[468px] px-0 py-6 sm:px-4">
        <div className="flex items-center justify-between px-4 sm:px-0">
          <h1 className="text-2xl font-extrabold tracking-tight">Spotted</h1>
          <Link
            href="/spot"
            className="rounded-full bg-gradient-to-br from-sky-400 to-violet-500 px-4 py-2 text-sm font-bold text-white"
          >
            + Post
          </Link>
        </div>

        {loading ? (
          <div className="mt-6 space-y-6">
            {[0, 1].map((i) => (
              <div key={i} className="h-[440px] animate-pulse bg-white/[0.04] sm:rounded-2xl" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mx-4 mt-6 rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6 text-center sm:mx-0">
            <h3 className="text-lg font-bold">The feed is being set up</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The community feed needs its database connected. Check back soon!
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="mx-4 mt-6 rounded-3xl border border-white/[0.06] bg-card p-8 text-center backdrop-blur-xl sm:mx-0">
            <div className="text-4xl">📷</div>
            <h3 className="mt-3 text-lg font-bold">No spots yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Be the first — identify a car and post it.</p>
            <Link
              href="/spot"
              className="mt-4 inline-block rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-5 py-2.5 font-semibold text-white"
            >
              Spot a car
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {posts.map((p) => (
              <article key={p.id} className="border-y border-white/[0.06] bg-card sm:rounded-2xl sm:border">
                {/* header */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar post={p} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-sm font-semibold">
                      {p.displayName}{" "}
                      <span className="font-normal text-muted-foreground">@{p.username}</span>
                    </div>
                    {(p.make || p.model) && (
                      <div className="truncate text-xs text-muted-foreground">
                        {p.make} {p.model} {p.yearRange}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(p.ts)}</span>
                </div>

                {/* image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={`${p.make} ${p.model}`} className="aspect-square w-full object-cover" />

                {/* actions */}
                <div className="px-3 pt-2.5">
                  <button
                    onClick={() => like(p.id)}
                    className={`text-2xl transition active:scale-90 ${liked[p.id] ? "" : "grayscale"}`}
                    aria-label="like"
                  >
                    ❤️
                  </button>
                </div>
                <div className="px-3 pb-3 pt-1">
                  <p className="text-sm font-semibold">
                    {p.likes} {p.likes === 1 ? "like" : "likes"}
                  </p>
                  {p.caption && (
                    <p className="mt-0.5 text-sm">
                      <span className="font-semibold">@{p.username}</span> {p.caption}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
