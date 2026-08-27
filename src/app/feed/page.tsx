"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Camera } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PageMasthead, Skeleton, Button } from "@/components/ui/editorial";
import { PostCard, type FeedPostView } from "@/components/feed/post-card";

export default function FeedPage() {
  const { status: authStatus } = useSession();
  const signedIn = authStatus === "authenticated";

  const [posts, setPosts] = useState<FeedPostView[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");

  // Pure fetch — it returns a page and never touches state itself, so the only
  // writes happen in the callbacks below rather than inside the effect body.
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
    // Re-runs on sign-in so `likedByYou` reflects the new session.
  }, [load, authStatus]);

  async function loadMore() {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await load(nextOffset);
      // Guard against a post being prepended between pages, which would
      // otherwise shift the window and repeat one.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setNextOffset(page.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  function patchLike(id: string, liked: boolean, count: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likedByYou: liked, likeCount: count } : p)),
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-5 py-10 pb-28">
        <PageMasthead
          eyebrow="Cars worth stopping for"
          title="Feed"
          count={loading ? "—" : `${posts.length} shown`}
        />

        {!configured ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <Camera className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-bold">The feed isn&apos;t switched on yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
              It needs a Vercel Blob store connected before posts can be saved.
            </p>
          </div>
        ) : loading ? (
          <div className="mt-6 space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-white/10 bg-card p-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="mt-3 aspect-[4/3] w-full" />
                <Skeleton className="mt-3 h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <Camera className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-bold">Nothing here yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
              Be the first to post a car.
            </p>
            <Link
              href={signedIn ? "/feed/new" : "/signin?callbackUrl=/feed/new"}
              className="press mt-5 inline-flex rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              Post a car
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-5">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  signedIn={signedIn}
                  onLikeChange={(liked, count) => patchLike(p.id, liked, count)}
                />
              ))}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-3 text-center text-[13px]"
              >
                {error}
              </div>
            )}

            {nextOffset !== null && (
              <div className="mt-6 flex justify-center">
                <Button onClick={loadMore} loading={loadingMore} size="lg">
                  {loadingMore ? "Loading" : "Load more"}
                </Button>
              </div>
            )}
            {nextOffset === null && posts.length > 0 && (
              <p className="mt-8 text-center text-[11px] uppercase tracking-wide opacity-40">
                You&apos;re all caught up
              </p>
            )}
          </>
        )}
      </main>

      {/* Floating composer entry. Sits above the feed, clear of the last card
          thanks to the main element's bottom padding. */}
      {configured && (
        <Link
          href={signedIn ? "/feed/new" : "/signin?callbackUrl=/feed/new"}
          aria-label="Post a car"
          title="Post a car"
          className="press fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/50 bg-white text-black shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:scale-105"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </Link>
      )}
    </>
  );
}
