"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share2,
  Repeat2,
  Check,
  Music,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Plus,
  Car,
  Flag,
  Bookmark,
  UserX,
} from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { FeedVideo } from "@/components/feed/feed-video";
import { CommentSheet } from "@/components/feed/comment-sheet";
import { timeAgo, type FeedPostView } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/report-reasons";

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
      {/* No disc behind the icon. A drop shadow carries it over a bright
          frame instead, which is what the black circle was there to do and
          costs nothing over a dark one. The 44pt target is on the button, not
          on anything you can see. */}
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center text-white transition-colors",
          "drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]",
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

/** Splits a caption so #hashtags become their own searchable links. */
function Caption({ text }: { text: string }) {
  // Captured split, so the tags survive in the output rather than being eaten
  // by the separator.
  const parts = text.split(/(#[\p{L}0-9_]+)/gu);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("#") && part.length > 1 ? (
          <Link
            key={i}
            href={`/search?q=${encodeURIComponent(part)}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-carz hover:underline"
          >
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}

/*
 * Where the slide's own furniture sits, measured from the nav rather than from
 * the bottom of the screen.
 *
 * The clip fills the viewport now, so "bottom" is behind the floating nav
 * bubble — which is exactly where the caption, the hashtags and the counts had
 * ended up. --nav-h is no use for this: it is the space reserved for the nav,
 * not the nav. The bubble's top edge is its gap plus its height.
 */
const NAV_TOP = "calc(var(--nav-gap) + var(--nav-bubble-h))";
/** The rail clears the bubble. */
const RAIL_BOTTOM = `calc(${NAV_TOP} + 0.5rem)`;
/** The caption clears the composer, which is centred over it and 4rem tall. */
const CAPTION_BOTTOM = `calc(${NAV_TOP} + 5rem)`;

export function Reel({
  post,
  active,
  buffer = false,
  signedIn,
  muted,
  onToggleMuted,
  onLikeChange,
  onCommentCountChange,
}: {
  post: FeedPostView;
  active: boolean;
  /** Preload the file even while off-screen. */
  buffer?: boolean;
  signedIn: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onLikeChange: (liked: boolean, count: number) => void;
  onCommentCountChange?: (count: number) => void;
}) {
  const handle = post.authorName.replace(/^@/, "");
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(post.youFollowAuthor);
  const [followBusy, setFollowBusy] = useState(false);
  const [reposted, setReposted] = useState(post.repostedByYou);
  const [menuOpen, setMenuOpen] = useState(false);
  // Two taps on the avatar follow. The first is still the link to their
  // channel, so this only has to notice the second and cancel the navigation.
  const lastAvatarTap = useRef(0);
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

  async function toggleFollow() {
    if (followBusy || post.youAreAuthor) return;
    if (!signedIn) {
      say("Sign in to follow");
      return;
    }
    const next = !following;
    setFollowing(next); // optimistic
    setFollowBusy(true);
    try {
      const res = await fetch(`/api/channel/${encodeURIComponent(handle)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow: next }),
      });
      if (!res.ok) {
        setFollowing(!next);
        say("Couldn't save that");
        return;
      }
      say(next ? `Following ${post.authorName}` : `Unfollowed ${post.authorName}`);
    } catch {
      setFollowing(!next);
      say("Network error");
    } finally {
      setFollowBusy(false);
    }
  }

  /** Two taps on the picture follows; one still opens the channel. */
  function onAvatarTap(e: React.MouseEvent) {
    const now = Date.now();
    if (now - lastAvatarTap.current < 300) {
      e.preventDefault();
      lastAvatarTap.current = 0;
      if (!following) void toggleFollow();
      else say(`Already following ${post.authorName}`);
      return;
    }
    lastAvatarTap.current = now;
  }

  async function toggleRepost() {
    const next = !reposted;
    setReposted(next); // optimistic and local: reposting has no store yet
    say(next ? "Reposted to your channel" : "Repost removed");
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
    // No background of its own: the app gradient shows through, so a portrait
    // clip letterboxes onto colour rather than onto a black slab.
    <section className="relative h-full w-full overflow-hidden">
      {/* Edge to edge, corner to corner — `object-cover`, so nothing shows
          through around a portrait clip and nothing is letterboxed. The rounded
          frame this used to carry is gone: the video is the screen now, and a
          radius only works when there is something behind it to see.
          Blurred while the comment sheet is up, so the clip stays visible above
          it without competing with the text. */}
      <div
        className={cn(
          "h-full w-full overflow-hidden transition-[filter] duration-300",
          commentsOpen && "blur-[6px]",
        )}
      >
        {isVideo ? (
          <FeedVideo
            videoUrl={post.videoUrl}
            posterUrl={post.imageUrl}
            edit={post.edit}
            active={active}
            buffer={buffer}
            muted={muted}
            onDoubleTap={doubleTapLike}
            onHold={() => {
              onToggleMuted();
              say(muted ? "Sound on" : "Sound off");
            }}
            fill
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt={post.caption ? post.caption.slice(0, 120) : "A car on the feed"}
            className="h-full w-full object-cover"
            loading={active ? "eager" : "lazy"}
          />
        )}
      </div>

      {/* Just enough to lift the status bar and the nav off the video, and no
          more — a fade rather than a scrim, so the clip itself is not dimmed.
          Inside the slide rather than over the scroller, which puts it beneath
          this reel's own controls: a fade painted above them would tint the
          rail it exists to make legible. Click-through, always. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 via-black/15 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
      />

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
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-200",
          commentsOpen && "opacity-0",
        )}
      />

      {/* Right rail. Hidden behind the comment sheet: the sheet's scrim is
          semi-transparent, so these stayed legible through it and read as a
          second set of controls competing with the ones in the sheet. Faded
          rather than unmounted, so the rail doesn't pop back on close, and
          made click-through so a tap near the edge can't reach a button that
          isn't really there. */}
      <div
        style={{ bottom: RAIL_BOTTOM }}
        className={cn(
          "absolute right-3 flex flex-col items-center gap-4 transition-opacity duration-200",
          commentsOpen && "pointer-events-none opacity-0",
        )}
        aria-hidden={commentsOpen || undefined}
        // Not just pointer-events-none: without `inert` these stay in the tab
        // order, so keyboard focus walks into buttons nobody can see.
        inert={commentsOpen}
      >
        {/* The creator sits at the head of the rail rather than down in the
            caption. Their picture is the tallest thing here and it belongs
            next to the actions taken on their clip. Double-tapping it follows
            them; the badge underneath is the same action for anyone who would
            never guess that. */}
        <div className="relative mb-2">
          <Link
            href={`/channel/${encodeURIComponent(handle)}`}
            onClick={onAvatarTap}
            aria-label={`${post.authorName} — double tap to follow`}
            className="press block"
          >
            <span
              className="block rounded-full ring-2 ring-white/80"
              style={{ viewTransitionName: `avatar-${handle}` }}
            >
              <Avatar src={post.authorImage} size={44} />
            </span>
          </Link>

          {!post.youAreAuthor && !following && (
            <button
              type="button"
              onClick={() => void toggleFollow()}
              disabled={followBusy}
              aria-label={`Follow ${post.authorName}`}
              className="press glass-bubble absolute -bottom-1.5 left-1/2 flex h-[18px] -translate-x-1/2 items-center gap-0.5 rounded-[35%] px-1.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-50"
            >
              <Plus className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
              Follow
            </button>
          )}
        </div>

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

        <RailButton
          label={reposted ? "Undo repost" : "Repost"}
          count={post.repostCount + (reposted && !post.repostedByYou ? 1 : 0)}
          active={reposted}
          onClick={signedIn ? () => void toggleRepost() : undefined}
          href={signedIn ? undefined : "/signin?callbackUrl=/feed"}
        >
          <Repeat2 className="h-5 w-5" strokeWidth={2} aria-hidden />
        </RailButton>

        <RailButton label="Share" onClick={share}>
          {copied ? (
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          ) : (
            <Share2 className="h-5 w-5" strokeWidth={2} aria-hidden />
          )}
        </RailButton>

        <RailButton label="More" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal className="h-5 w-5" strokeWidth={2} aria-hidden />
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

      {/* Caption block — hidden with the rail for the same reason. */}
      <div
        style={{ bottom: CAPTION_BOTTOM }}
        className={cn(
          "absolute inset-x-0 px-4 pr-20 transition-opacity duration-200",
          commentsOpen && "pointer-events-none opacity-0",
        )}
        aria-hidden={commentsOpen || undefined}
        inert={commentsOpen}
      >
        {/* The creator, not the post. Tapping a face should go to whose face
            it is — the post already fills the screen you are on.
            `viewTransitionName` pairs this circle with the one in the channel
            header, so the avatar travels between the two rather than two
            unrelated pictures cross-fading. */}
        <Link
          href={`/channel/${encodeURIComponent(post.authorName.replace(/^@/, ""))}`}
          className="flex items-center gap-2"
        >
          <span
            className="shrink-0"
            style={{ viewTransitionName: `avatar-${post.authorName.replace(/^@/, "")}` }}
          >
            <Avatar src={post.authorImage} size={28} />
          </span>
          <span className="truncate text-[13px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {post.authorName}
          </span>
          <span className="shrink-0 text-[11px] text-white/60">{timeAgo(post.createdAt)}</span>
        </Link>

        {(post.carName || post.caption) && (
          <div className="glass-card mt-2 rounded-2xl px-3.5 py-2.5">
            {/* The car, first and on its own line. It is the one thing every
                clip here is actually about, and it is now required at post
                time — older clips simply have none. */}
            {post.carName && (
              <p className="flex items-center gap-1.5 text-[13px] font-bold leading-tight">
                <Car className="h-3.5 w-3.5 shrink-0 text-carz" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{post.carName}</span>
              </p>
            )}
            {post.caption && (
              <p
                className={cn(
                  "line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed",
                  post.carName && "mt-1.5",
                )}
              >
                <Caption text={post.caption} />
              </p>
            )}
          </div>
        )}

        {isVideo && post.edit.musicTitle && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
            <Music className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{post.edit.musicTitle}</span>
          </p>
        )}
      </div>

      {menuOpen && (
        <PostMenu
          post={post}
          signedIn={signedIn}
          onClose={() => setMenuOpen(false)}
          onSay={say}
        />
      )}

      {commentsOpen && (
        <CommentSheet
          postId={post.id}
          signedIn={signedIn}
          youAreAuthor={post.youAreAuthor}
          onClose={() => setCommentsOpen(false)}
          onCountChange={onCommentCountChange}
        />
      )}
    </section>
  );
}

/**
 * Block, report, save.
 *
 * A sheet rather than a popover: these are decisions, two of them about another
 * person, and they deserve the full attention a sheet takes. Blocking and
 * reporting both ask once more before they fire — a mis-tap on a rail button
 * should not silently file a complaint about somebody.
 */
function PostMenu({
  post,
  signedIn,
  onClose,
  onSay,
}: {
  post: FeedPostView;
  signedIn: boolean;
  onClose: () => void;
  onSay: (message: string) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState<"block" | "report" | null>(null);
  const [busy, setBusy] = useState(false);
  const handle = post.authorName.replace(/^@/, "");

  async function post_(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/feed/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      return { ok: res.ok && d?.ok !== false, error: d?.error as string | undefined };
    } catch {
      return { ok: false, error: "Network error." };
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <Sheet onClose={onClose} title="Sign in first">
        <p className="px-1 pb-2 text-[13px] opacity-70">
          Saving, blocking and reporting are all tied to your account.
        </p>
        <Link
          href="/signin?callbackUrl=/feed"
          className="press mt-2 flex min-h-11 items-center justify-center rounded-2xl bg-white text-sm font-bold text-black"
        >
          Sign in
        </Link>
      </Sheet>
    );
  }

  if (confirming === "block") {
    return (
      <Sheet onClose={onClose} title={`Block ${post.authorName}?`}>
        <p className="px-1 pb-3 text-[13px] opacity-70">
          Their clips stop appearing in your feed. They are not told.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const r = await post_({ action: "block", username: handle, on: true });
            onSay(r.ok ? `Blocked ${post.authorName}` : r.error || "Couldn't block");
            onClose();
          }}
          className="press flex min-h-11 w-full items-center justify-center rounded-2xl bg-neon-red text-sm font-bold text-white disabled:opacity-50"
        >
          Block
        </button>
      </Sheet>
    );
  }

  if (confirming === "report") {
    return (
      <Sheet onClose={onClose} title="Report this clip">
        <div className="space-y-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              disabled={busy}
              onClick={async () => {
                const r = await post_({
                  action: "report",
                  postId: post.id,
                  authorName: post.authorName,
                  reason,
                });
                onSay(r.ok ? "Reported — thank you" : r.error || "Couldn't report");
                onClose();
              }}
              className="press glass-card flex min-h-11 w-full items-center rounded-2xl px-4 text-left text-[13px] font-semibold disabled:opacity-50"
            >
              {reason}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title={post.carName || post.authorName}>
      <div className="space-y-2">
        <MenuRow
          Icon={Bookmark}
          label={saved ? "Saved" : "Save"}
          onClick={async () => {
            const next = !saved;
            setSaved(next);
            const r = await post_({ action: "save", postId: post.id, on: next });
            if (!r.ok) {
              setSaved(!next);
              onSay(r.error || "Couldn't save");
            }
          }}
        />
        {!post.youAreAuthor && (
          <>
            <MenuRow Icon={Flag} label="Report clip" onClick={() => setConfirming("report")} />
            <MenuRow
              Icon={UserX}
              label={`Block ${post.authorName}`}
              destructive
              onClick={() => setConfirming("block")}
            />
          </>
        )}
      </div>
    </Sheet>
  );
}

function MenuRow({
  Icon,
  label,
  destructive,
  onClick,
}: {
  Icon: typeof Flag;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press glass-card flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 text-left text-[13px] font-semibold",
        destructive && "text-neon-red",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

/** The sheet these all share. */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-[75] bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="nav-sheet-in fixed inset-x-0 bottom-0 z-[80] rounded-t-3xl border-t border-white/12 bg-black/80 px-4 pb-8 pt-4 backdrop-blur-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" aria-hidden />
        <p className="mb-3 truncate px-1 text-[13px] font-bold">{title}</p>
        {children}
      </div>
    </>
  );
}
