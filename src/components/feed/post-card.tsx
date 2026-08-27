"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { VideoEdit } from "@/components/feed/feed-video";
import { cn } from "@/lib/utils";

// Shared feed vocabulary: the post shape, the relative stamp and the like
// control. The scroller renders posts through `Reel`; the post detail page
// composes its own layout from these.

export type FeedPostView = {
  id: string;
  authorName: string;
  authorImage: string;
  mediaKind: "photo" | "video";
  imageUrl: string;
  videoUrl: string;
  durationMs: number;
  edit: VideoEdit;
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

