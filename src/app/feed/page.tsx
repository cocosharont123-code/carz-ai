"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Camera } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Spinner } from "@/components/ui/editorial";
import { Reel } from "@/components/feed/reel";
import type { FeedPostView } from "@/components/feed/post-card";

export default function FeedPage() {
  const { status: authStatus } = useSession();
  const signedIn = authStatus === "authenticated";

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<FeedPostView[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true); // audible autoplay is blocked everywhere
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");

  // iOS bounces the *document* as well as the scroller, so pinning it here is
  // what stops the whole screen sliding when there's nowhere left to go.
  // Scoped to this page and restored on the way out, so pull-to-refresh still
  // works everywhere else.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehavior;
    root.style.overscrollBehavior = "none";
    return () => {
      root.style.overscrollBehavior = previous;
    };
  }, []);

  // Pure fetch — state is only written in the callbacks below, never inside an
  // effect body.
  const load = useCallback(async (offset: number) => {
    const res = await fetch(`/api/feed/posts?offset=${offset}`, { cache: "no-store" });
    const d = await res.json();
    if (d.configured === false) {
      return { configured: false, posts: [] as FeedPostView[], nextOffset: null };
    }
    if (!res.ok) throw new Error(d.error || "Couldn't load the feed.");
    return {
      configured: true,
      posts: (Array.isArray(d.posts) ? d.posts : []) as FeedPostView[],
      nextOffset: (d.nextOffset ?? null) as number | null,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(0)
      .then((page) => {
        if (cancelled) return;
        setConfigured(page.configured);
        setPosts(page.posts);
        setNextOffset(page.nextOffset);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load, authStatus]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await load(nextOffset);
      setPosts((prev) => {
        // A post prepended between pages would shift the window and repeat one.
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setNextOffset(page.nextOffset);
    } catch {
      /* keep what's on screen; the next scroll retries */
    } finally {
      setLoadingMore(false);
    }
  }, [load, loadingMore, nextOffset]);

  // Read by the observer below, which outlives the render that created it.
  // Refs rather than deps so a new page doesn't tear down and rebuild the
  // observer on every append.
  const loadMoreRef = useRef(loadMore);
  const countRef = useRef(0);
  useEffect(() => {
    loadMoreRef.current = loadMore;
    countRef.current = posts.length;
  }, [loadMore, posts.length]);

  /**
   * Which slide is on screen. An observer beats a scroll handler here: snap
   * points mean the browser settles on exactly one slide, and a 60% threshold
   * fires once per slide instead of on every pixel of momentum.
   *
   * The prefetch is triggered from this callback rather than its own effect —
   * it's a response to an external event, which is where a state write belongs.
   */
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || posts.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isFinite(i)) continue;
          setActiveIndex(i);
          // Fetch while a few slides are still in hand, so a scroll never
          // lands on the end. loadMore() no-ops once there's nothing left.
          if (i >= countRef.current - 3) void loadMoreRef.current();
        }
      },
      { root, threshold: 0.6 },
    );

    const slides = root.querySelectorAll("[data-index]");
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [posts.length]);

  function patchLike(id: string, liked: boolean, count: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likedByYou: liked, likeCount: count } : p)),
    );
  }

  // The sheet knows the real comment count once it has loaded them, so the
  // rail badge follows it rather than drifting after an add or a delete.
  function patchCommentCount(id: string, count: number) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, commentCount: count } : p)));
  }

  const composerHref = signedIn ? "/feed/new" : "/signin?callbackUrl=/feed/new";

  // A fixed-height column: the header keeps its natural size and the scroller
  // takes the rest, so one slide is exactly one screen. `dvh` rather than `vh`
  // because mobile browser chrome collapses on scroll.
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <SiteHeader />

      {!configured ? (
        <Centered>
          <Camera className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
          <h1 className="mt-3 text-lg font-bold">The feed isn&apos;t switched on yet</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
            It needs a Vercel Blob store connected before posts can be saved.
          </p>
        </Centered>
      ) : loading ? (
        <Centered>
          <Spinner className="mx-auto h-6 w-6" />
        </Centered>
      ) : error ? (
        <Centered>
          <h1 className="text-lg font-bold">Couldn&apos;t load the feed</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">{error}</p>
        </Centered>
      ) : posts.length === 0 ? (
        <Centered>
          <Camera className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
          <h1 className="mt-3 text-lg font-bold">Nothing here yet</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
            Be the first to post a clip.
          </p>
          <Link
            href={composerHref}
            className="press mt-5 inline-flex rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
          >
            Post a clip
          </Link>
        </Centered>
      ) : (
        /* `overscroll-y-none`, not `contain`: contain stops the scroll chaining
           to the page but still lets the scroller rubber-band, so dragging past
           the first or last clip visibly moves the screen. None kills the bounce
           too. Nothing is rendered after the last slide either — a loading row
           in the flow would be somewhere to scroll to that isn't a clip. */
        <div
          ref={scrollerRef}
          className="relative flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-y-none scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {posts.map((p, i) => (
            <div key={p.id} data-index={i} className="h-full w-full">
              <Reel
                post={p}
                active={i === activeIndex}
                signedIn={signedIn}
                muted={muted}
                onToggleMuted={() => setMuted((m) => !m)}
                onLikeChange={(liked, count) => patchLike(p.id, liked, count)}
                onCommentCountChange={(count) => patchCommentCount(p.id, count)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Composer. Floats over the scroller rather than inside it, so it stays
          put while slides move underneath. */}
      {configured && (
        <Link
          href={composerHref}
          aria-label="Post a clip"
          title="Post a clip"
          className="press fixed bottom-6 left-1/2 z-40 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-white/50 bg-white text-black shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition hover:scale-105"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-5">
      <div className="text-center">{children}</div>
    </div>
  );
}
