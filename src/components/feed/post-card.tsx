"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { cn } from "@/lib/utils";

export type FeedPostView = {
  id: string;
  authorName: string;
  authorImage: string;
  imageUrl: string;
  caption: string;
  createdAt: number;
  likeCount: number;
  commentCount: number;
  likedByYou: boolean;
  youAreAuthor: boolean;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact relative stamp — "3h", "2d". Falls back to a date past a month. */
export function timeAgo(ts: number, now = Date.now()): string {
  const d = Math.max(0, now - ts);
  if (d < MINUTE) return "just now";
  if (d < HOUR) return `${Math.floor(d / MINUTE)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < WEEK) return `${Math.floor(d / DAY)}d`;
  if (d < 30 * DAY) return `${Math.floor(d / WEEK)}w`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Like toggle with optimistic state. The count and the filled heart flip on tap
 * and roll back if the write fails, so a like never appears to land when it
 * didn't. Signed-out taps go to the sign-in page rather than failing silently.
 */
export function LikeButton({
  postId,
  liked,
  count,
  signedIn,
  onChange,
}: {
  postId: string;
  liked: boolean;
  count: number;
  signedIn: boolean;
  onChange?: (liked: boolean, count: number) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const nextLiked = !liked;
    const nextCount = count + (nextLiked ? 1 : -1);
    onChange?.(nextLiked, nextCount);
    setBusy(true);
    try {
      const res = await fetch(`/api/feed/posts/${postId}/like`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onChange?.(liked, count); // roll back
        return;
      }
      // Trust the server's count over the guess — it settles concurrent likes.
      onChange?.(!!data.liked, Number(data.likeCount) ?? nextCount);
    } catch {
      onChange?.(liked, count);
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <Link
        href="/signin?callbackUrl=/feed"
        className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3 py-1.5 text-[13px] font-semibold transition hover:bg-black/[0.1]"
      >
        <Heart className="h-4 w-4" strokeWidth={2} aria-hidden />
        {count}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
        liked ? "bg-black text-white" : "bg-black/[0.06] hover:bg-black/[0.1]",
      )}
    >
      <Heart className="h-4 w-4" strokeWidth={2} fill={liked ? "currentColor" : "none"} aria-hidden />
      {count}
    </button>
  );
}

export function PostCard({
  post,
  signedIn,
  onLikeChange,
}: {
  post: FeedPostView;
  signedIn: boolean;
  onLikeChange?: (liked: boolean, count: number) => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-card text-card-foreground">
      <header className="flex items-center gap-2.5 px-4 py-3">
        <Avatar src={post.authorImage} size={30} />
        <span className="truncate text-[13px] font-bold">{post.authorName}</span>
        <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide opacity-50">
          {timeAgo(post.createdAt)}
        </span>
      </header>

      <Link href={`/feed/${post.id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.imageUrl}
          alt={post.caption ? post.caption.slice(0, 120) : "A car posted to the feed"}
          className="aspect-[4/3] w-full bg-black/5 object-cover"
          loading="lazy"
        />
      </Link>

      <div className="px-4 py-3.5">
        {post.caption && (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{post.caption}</p>
        )}
        <div className={cn("flex items-center gap-2", post.caption && "mt-3")}>
          <LikeButton
            postId={post.id}
            liked={post.likedByYou}
            count={post.likeCount}
            signedIn={signedIn}
            onChange={onLikeChange}
          />
          <Link
            href={`/feed/${post.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3 py-1.5 text-[13px] font-semibold transition hover:bg-black/[0.1]"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
            {post.commentCount}
          </Link>
        </div>
      </div>
    </article>
  );
}
