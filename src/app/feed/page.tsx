"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Plus, Camera, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/editorial";
import { Reel } from "@/components/feed/reel";
import type { FeedPostView } from "@/components/feed/post-card";

/**
 * How many times the feed is laid out once there is nothing left to fetch.
 *
 * Two, not more: the viewer scrolls out of the first lap into the second, and
 * the scroller is then silently wound back one lap to where the identical clip
 * sits in the first. There is always a full lap ahead, the rewind is invisible
 * because it lands on the same post at the same offset, and the DOM stays at
 * twice the feed rather than growing a lap at a time until the browser runs out
 * of video elements it is willing to hold.
 */
const LOOP_LAPS = 2;

/**
 * How far either side of the current slide a clip stays mounted.
 *
 * One. The slide on screen, the one above it and the one below — enough that a
 * swipe never lands on an unmounted slide, and no more. Everything beyond keeps
 * its box, so the scroll height and the snap points are unchanged, but holds no
 * <video> at all: a feed that mounts every clip is a feed holding a hundred
 * media elements, which is where the jank comes from on a phone.
 */
const WINDOW = 1;

/**
 * How far out clips are fetched in full.
 *
 * Wider than the mount window on purpose: a clip three slides away holds no
 * <video> yet, but its file can already be in the browser's cache, so the
 * element that mounts a moment later has nothing left to wait for. Buffering is
 * bytes; mounting is decoders. Only the second is scarce.
 */
const BUFFER = 3;

/** Puts one post at the head of the list, leaving the rest in order. */
function leadWith(posts: FeedPostView[], id: string): FeedPostView[] {
  const i = posts.findIndex((p) => p.id === id);
  if (i <= 0) return posts;
  return [posts[i], ...posts.slice(0, i), ...posts.slice(i + 1)];
}

export default function FeedPage() {
  // useSearchParams opts a route into client rendering unless it sits under a
  // Suspense boundary. The fallback is the scroller's own loading state, so a
  // cold load looks the same either way.
  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedInner />
    </Suspense>
  );
}

function FeedLoading() {
  return (
    <div
      className="flex h-[100dvh] items-center justify-center"
      style={{
        marginTop: "calc(-1 * (var(--safe-top) + var(--back-h)))",
        marginBottom: "calc(-1 * var(--nav-h))",
      }}
    >
      <Spinner className="h-6 w-6" />
    </div>
  );
}

function FeedInner() {
  const { status: authStatus } = useSession();
  const signedIn = authStatus === "authenticated";

  const scrollerRef = useRef<HTMLDivElement>(null);
  const startId = useSearchParams().get("start");
  const [posts, setPosts] = useState<FeedPostView[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [activeIndex, setActiveIndex] = useState(0);
  // Sound on by default. Browsers block audible autoplay, so FeedVideo falls
  // back to muting that one element and playing anyway — a silent clip beats a
  // stalled one, and the viewer's unmute works from their first tap onward.
  const [muted, setMuted] = useState(false);
  // Which feed. "For you" is everything; "Following" is only the accounts this
  // viewer follows, which the API answers — an empty Following stays empty
  // rather than quietly falling back to everything.
  const [tab, setTab] = useState<"you" | "following">("you");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");

  // Looping starts only once the feed is exhausted: while there are still real
  // pages to fetch, repeating what's already been seen would push the unseen
  // clips further away.
  const lapSize = nextOffset === null ? posts.length : 0;
  const looping = lapSize > 0;
  const laps = looping ? LOOP_LAPS : 1;

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
  const load = useCallback(async (offset: number, which: "you" | "following") => {
    const qs = `offset=${offset}${which === "following" ? "&following=1" : ""}`;
    const res = await fetch(`/api/feed/posts?${qs}`, { cache: "no-store" });
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
    load(0, tab)
      .then((page) => {
        if (cancelled) return;
        setConfigured(page.configured);
        setActiveIndex(0);
        scrollerRef.current?.scrollTo({ top: 0 });
        // Opened from a channel thumbnail: that video leads, and the rest of
        // the feed follows it. Reordering beats scrolling to an index — the
        // clip may not be on the first page at all, and a scroller that jumps
        // after paint is exactly the thing that feels cheap.
        setPosts(startId ? leadWith(page.posts, startId) : page.posts);
        setNextOffset(page.nextOffset);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  // startId is a dependency, not an omission: arriving from a different
  // thumbnail has to reorder the feed around the new video rather than keep
  // showing the one before it.
  }, [load, authStatus, startId, tab]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await load(nextOffset, tab);
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
  }, [load, loadingMore, nextOffset, tab]);

  // Read by the observer below, which outlives the render that created it.
  // Refs rather than deps so a new page doesn't tear down and rebuild the
  // observer on every append.
  /**
   * Plays, batched.
   *
   * Counted once per clip per visit, held here and flushed on a timer — a
   * request per slide would be a request every couple of seconds for as long as
   * anyone is scrolling. Sent with keepalive as well, so the last few survive
   * the page being closed, which is exactly when they would otherwise be lost.
   */
  const seenRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Record<string, number>>({});

  const flushViews = useCallback((keepalive = false) => {
    const views = pendingRef.current;
    if (Object.keys(views).length === 0) return;
    pendingRef.current = {};
    void fetch("/api/feed/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ views }),
      keepalive,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => flushViews(), 15_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flushViews(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      flushViews(true);
    };
  }, [flushViews]);

  const countView = useCallback((postId: string) => {
    if (seenRef.current.has(postId)) return;
    seenRef.current.add(postId);
    pendingRef.current[postId] = (pendingRef.current[postId] ?? 0) + 1;
  }, []);

  const loadMoreRef = useRef(loadMore);
  const countRef = useRef(0);
  const postsRef = useRef<FeedPostView[]>([]);
  const countViewRef = useRef(countView);
  const lapRef = useRef(0);
  useEffect(() => {
    loadMoreRef.current = loadMore;
    countRef.current = posts.length * laps;
    postsRef.current = posts;
    countViewRef.current = countView;
    lapRef.current = lapSize;
  }, [loadMore, posts, laps, lapSize, countView]);

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
          const seen = postsRef.current[i % (postsRef.current.length || 1)];
          if (seen) countViewRef.current(seen.id);
          // Fetch while a few slides are still in hand, so a scroll never
          // lands on the end. loadMore() no-ops once there's nothing left.
          if (i >= countRef.current - 3) void loadMoreRef.current();

          // Scrolled out of the first lap and into the repeat: wind the
          // scroller back one lap, onto the identical post at the identical
          // offset. Nothing moves on screen, and the lap just left is a full
          // feed's worth of scrolling ahead again.
          //
          // `scroll-smooth` is off for the write: animating it would be the one
          // thing that made the seam visible.
          const lap = lapRef.current;
          if (lap > 0 && i >= lap) {
            const previous = root.style.scrollBehavior;
            root.style.scrollBehavior = "auto";
            root.scrollTop -= lap * root.clientHeight;
            root.style.scrollBehavior = previous;
            setActiveIndex(i - lap);
          }
        }
      },
      { root, threshold: 0.6 },
    );

    const slides = root.querySelectorAll("[data-index]");
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  // Slide count, not post count: a lap appearing adds slides to observe.
  }, [posts.length, laps]);

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

  // One slide is exactly one screen — the whole screen, not the screen minus
  // the furniture. The column this sits in pads for the status bar above and
  // reserves the nav's height below; the negative margins give both back, so
  // the video runs corner to corner and the nav bubble floats over it rather
  // than beside it.
  //
  // Still in the flow rather than fixed: taking it out of the flow once made
  // the whole page blank, and this achieves the same geometry without it.
  return (
    <div
      className="relative flex h-[100dvh] flex-col overflow-hidden"
      style={{
        marginTop: "calc(-1 * (var(--safe-top) + var(--back-h)))",
        marginBottom: "calc(-1 * var(--nav-h))",
      }}
    >
      {/* The two feeds, centred at the top the way every reel app puts them.
          Over the clip rather than above it: a bar in the flow would cost the
          video its height. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex items-center justify-center gap-1">
        {(
          [
            ["you", "For you"],
            ["following", "Following"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "press pointer-events-auto min-h-11 rounded-full px-4 text-sm font-bold transition-opacity",
              "drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]",
              tab === key ? "text-white" : "text-white/55 hover:text-white/80",
            )}
          >
            {label}
            {/* An underline rather than a filled chip: a pill up here competes
                with the clip, and the line says which is live just as well. */}
            <span
              aria-hidden
              className={cn(
                "mx-auto mt-0.5 block h-0.5 w-6 rounded-full bg-white transition-opacity",
                tab === key ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        ))}
      </div>

      {/* Post and search, in the corner. The composer used to be a large button
          in the middle of the clip, which is the one place on this screen
          nothing should sit. */}
      <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-2">
        <Link
          href="/search"
          aria-label="Search accounts"
          className="press glass-bubble pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full"
        >
          <Search className="h-[18px] w-[18px] text-white" strokeWidth={2} aria-hidden />
        </Link>
        {configured && (
          <Link
            href={composerHref}
            aria-label="Post a clip"
            className="press glass-bubble pointer-events-auto flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold"
          >
            <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
            Post
          </Link>
        )}
      </div>

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
          {/* The same posts laid out `laps` times once the feed is exhausted.
              Every copy of a post is the same post — a like or a comment on one
              is patched by id, so all of its copies agree. */}
          {Array.from({ length: laps }, (_, lap) =>
            posts.map((p, i) => {
              const index = lap * posts.length + i;
              const distance = Math.abs(index - activeIndex);
              const mounted = distance <= WINDOW;
              return (
                // The box exists whether or not anything is in it, so the
                // scroll height and every snap point stay exactly where they
                // were and scrolling never has to be corrected.
                <div
                  key={`${lap}:${p.id}`}
                  data-index={index}
                  className="h-full w-full snap-start snap-always"
                >
                  {mounted ? (
                    <Reel
                      post={p}
                      active={index === activeIndex}
                      buffer={distance <= BUFFER}
                      signedIn={signedIn}
                      muted={muted}
                      onToggleMuted={() => setMuted((m) => !m)}
                      onLikeChange={(liked, count) => patchLike(p.id, liked, count)}
                      onCommentCountChange={(count) => patchCommentCount(p.id, count)}
                    />
                  ) : (
                    // Not reachable without passing through a mounted slide
                    // first, so it is never seen — it only has to hold height.
                    <div className="h-full w-full" aria-hidden />
                  )}
                </div>
              );
            }),
          )}
        </div>
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
