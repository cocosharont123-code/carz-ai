"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, Check, Music, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { FeedVideo } from "@/components/feed/feed-video";
import { CommentSheet } from "@/components/feed/comment-sheet";
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
  onCommentCountChange,
}: {
  post: FeedPostView;
  active: boolean;
  signedIn: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onLikeChange: (liked: boolean, count: number) => void;
  onCommentCountChange?: (count: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Keyed so a second double-tap restarts the animation rather than being
  // swallowed while the first one is still running.
  const [burst, setBurst] = useState(0);
  const [notice, setNotice] = useState("");
  const isVideo = post.mediaKind === "video" && !!post.videoUrl;

  /** Transient message on the clip. A like that silently reverts is
   *  indistinguishable from one that never fired. */
  function say(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((n) => (n === message ? "" : n)), 2600);
  }

  async function toggleLike(next: boolean) {
    if (likeBusy) return;
    if (!signedIn) {
      say("Sign in to like");
      return;
    }
    const nextCount = post.likeCount + (next ? 1 : -1);
    onLikeChange(next, nextCount); // optimistic
    setLikeBusy(true);
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/like`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        onLikeChange(post.likedByYou, post.likeCount); // roll back
        say(d.error || (res.status === 401 ? "Sign in to like" : "Couldn't save that like"));
        return;
      }
      // Number(undefined) is NaN, and `??` doesn't catch NaN — so this has to
      // be a finite check, not a nullish fallback, or the count renders "NaN".
      const serverCount = Number(d.likeCount);
      onLikeChange(!!d.liked, Number.isFinite(serverCount) ? serverCount : nextCount);
    } catch {
      onLikeChange(post.likedByYou, post.likeCount);
      say("Network error — like not saved");
    } finally {
      setLikeBusy(false);
    }
  }

  function like() {
    void toggleLike(!post.likedByYou);
  }

  /**
   * Double tap likes — it never unlikes. Tapping twice on something you already
   * liked reads as enthusiasm, not as taking it back, so the heart still flies
   * and the count is left alone. Unliking stays on the rail button.
   */
  function doubleTapLike() {
    setBurst((n) => n + 1);
    if (post.likedByYou) return;
    void toggleLike(true); // reports its own failure, including signed-out
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
          car shot cropped to a portrait slide loses the car.
          Blurred while the comment sheet is up, so the clip stays visible
          above it without competing with the text. */}
      <div
        className={cn(
          "h-full w-full transition-[filter] duration-300",
          commentsOpen && "blur-[6px]",
        )}
      >
        {isVideo ? (
          <FeedVideo
            videoUrl={post.videoUrl}
            posterUrl={post.imageUrl}
            edit={post.edit}
            active={active}
            muted={muted}
            onDoubleTap={doubleTapLike}
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
      </div>

      {/* The double-tap heart. Purely decorative and click-through, so it can
          never swallow the next tap. */}
      {burst > 0 && (
        <span
          key={burst}
          aria-hidden
          className="carz-heart-burst pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <Heart className="h-24 w-24 text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]" fill="currentColor" strokeWidth={0} />
        </span>
      )}

      {/* Why a like didn't land. Above the caption so it reads immediately,
          and click-through so it can't eat the next tap. */}
      {notice && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-40 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-[13px] font-semibold text-white"
        >
          {notice}
        </div>
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

        <RailButton
          label="Comments"
          count={post.commentCount}
          onClick={() => setCommentsOpen(true)}
        >
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

      {commentsOpen && (
        <CommentSheet
          postId={post.id}
          signedIn={signedIn}
          onClose={() => setCommentsOpen(false)}
          onCountChange={onCommentCountChange}
        />
      )}
    </section>
  );
}
