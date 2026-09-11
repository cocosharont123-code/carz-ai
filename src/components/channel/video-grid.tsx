"use client";

import { Play, Heart, Video } from "lucide-react";
import type { FeedPostView } from "@/components/feed/post-card";

const nf = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * The channel's videos, as a poster grid.
 *
 * 9:16 tiles on a hairline gap, the way a reel grid reads — a square grid of
 * portrait video either crops the subject out or letterboxes every tile.
 * Tapping one opens the feed on that video rather than a page of its own.
 */
export function VideoGrid({
  posts,
  onOpen,
}: {
  posts: FeedPostView[];
  onOpen: (postId: string) => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="mt-10 px-5 text-center">
        <Video className="mx-auto h-8 w-8 opacity-30" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 text-sm font-semibold">No videos yet</p>
        <p className="mx-auto mt-1 max-w-xs text-[13px] opacity-60">
          Clips posted to the feed show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-3 gap-0.5">
      {posts.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(p.id)}
          aria-label={p.caption ? `Play: ${p.caption.slice(0, 60)}` : "Play video"}
          className="group relative aspect-[9/16] overflow-hidden bg-white/[0.04]"
        >
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Play className="h-5 w-5 opacity-40" aria-hidden />
            </span>
          )}

          {/* Legible over a bright poster without dimming a dark one. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] font-semibold text-white">
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} aria-hidden />
              {nf.format(p.likeCount + p.commentCount)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" fill={p.likedByYou ? "currentColor" : "none"} aria-hidden />
              {nf.format(p.likeCount)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
