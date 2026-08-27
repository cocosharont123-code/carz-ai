"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, Check, Music, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { FeedVideo } from "@/components/feed/feed-video";
import { timeAgo, type FeedPostView } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";

/**
 * One action on the right rail. White on the media rather than a chip: there is
 * no card behind it here, so the buttons carry their own contrast with a drop
 * shadow instead of a background.
 */
function RailButton({
  label,
  count,
  active,
  filled,
  onClick,
  href,
  children,
}: {
  label: string;
  count?: number;
  active?: boolean;
  filled?: boolean;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition",
          active && "text-neon-red",
        )}
      >
        {children}
      </span>
      {count !== undefined && (
        <span className="mt-1 text-[11px] font-bold tabular-nums text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {count}
        </span>
      )}
    </>
  );
  void filled;

  const cls = "press flex flex-col items-center";
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {inner}
    </button>
  );
}

export function Reel({
  post,
  active,
  signedIn,
  muted,
  onToggleMuted,
  onLikeChange,
}: {
  post: FeedPostView;
  active: boolean;
  signedIn: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onLikeChange: (liked: boolean, count: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const isVideo = post.mediaKind === "video" && !!post.videoUrl;

  async function like() {
    if (!signedIn || likeBusy) return;
    const nextLiked = !post.likedByYou;
    const nextCount = post.likeCount + (nextLiked ? 1 : -1);
    onLikeChange(nextLiked, nextCount); // optimistic
    setLikeBusy(true);
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/like`, { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        onLikeChange(post.likedByYou, post.likeCount); // roll back
        return;
      }
      onLikeChange(!!d.liked, Number(d.likeCount) ?? nextCount);
    } catch {
      onLikeChange(post.likedByYou, post.likeCount);
    } finally {
      setLikeBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/feed/${post.id}`;
    const text = post.caption?.trim() ? post.caption.trim().slice(0, 120) : "Seen on the Carz feed";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Carz AI", text, url });
        return;
      } catch {
        /* dismissed — fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {/* Media fills the slide. `object-contain` rather than cover: a landscape
          car shot cropped to a portrait slide loses the car. */}
      {isVideo ? (
        <FeedVideo
          videoUrl={post.videoUrl}
          posterUrl={post.imageUrl}
          edit={post.edit}
          active={active}
          muted={muted}
          fill
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt={post.caption ? post.caption.slice(0, 120) : "A car on the feed"}
          className="h-full w-full object-contain"
          loading={active ? "eager" : "lazy"}
        />
      )}

      {/* Scrim so white overlay text survives a bright sky or a white car. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Right rail */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4">
        <RailButton
          label={post.likedByYou ? "Unlike" : "Like"}
          count={post.likeCount}
          active={post.likedByYou}
          onClick={signedIn ? like : undefined}
          href={signedIn ? undefined : "/signin?callbackUrl=/feed"}
        >
          <Heart
            className="h-5 w-5"
            strokeWidth={2}
            fill={post.likedByYou ? "currentColor" : "none"}
            aria-hidden
          />
        </RailButton>

        <RailButton label="Comments" count={post.commentCount} href={`/feed/${post.id}`}>
          <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
        </RailButton>

        <RailButton label="Share" onClick={share}>
          {copied ? (
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          ) : (
            <Share2 className="h-5 w-5" strokeWidth={2} aria-hidden />
          )}
        </RailButton>

        {isVideo && (
          <RailButton label={muted ? "Unmute" : "Mute"} onClick={onToggleMuted}>
            {muted ? (
              <VolumeX className="h-5 w-5" strokeWidth={2} aria-hidden />
            ) : (
              <Volume2 className="h-5 w-5" strokeWidth={2} aria-hidden />
            )}
          </RailButton>
        )}
      </div>

      {/* Caption block */}
      <div className="absolute inset-x-0 bottom-0 p-4 pr-20">
        <Link href={`/feed/${post.id}`} className="flex items-center gap-2">
          <Avatar src={post.authorImage} size={28} />
          <span className="truncate text-[13px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {post.authorName}
          </span>
          <span className="shrink-0 text-[11px] text-white/60">{timeAgo(post.createdAt)}</span>
        </Link>

        {post.caption && (
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {post.caption}
          </p>
        )}

        {isVideo && post.edit.musicTitle && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
            <Music className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{post.edit.musicTitle}</span>
          </p>
        )}
      </div>
    </section>
  );
}
