"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { cn } from "@/lib/utils";

type Channel = {
  username: string;
  displayName: string;
  image: string;
  bio: string;
  cover: string;
  member: boolean;
  isYou: boolean;
};

type Stats = { followers: number; following: number; youFollow: boolean; posts: number };

const nf = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Cover, avatar, name, bio, counts, follow.
 *
 * The avatar carries `view-transition-name`, so navigating here from a reel
 * animates the same circle from the caption into this header rather than
 * cross-fading two unrelated pictures.
 */
export function ChannelHeader({
  channel,
  stats,
  onStats,
}: {
  channel: Channel;
  stats: Stats | null;
  onStats: (s: Stats) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const following = !!stats?.youFollow;

  async function toggleFollow() {
    if (busy || !stats) return;
    setBusy(true);
    setError("");

    // Optimistic: the button is the whole interaction, and a spinner on it
    // reads as broken. Rolled back if the write fails.
    const before = stats;
    onStats({
      ...stats,
      youFollow: !following,
      followers: Math.max(0, stats.followers + (following ? -1 : 1)),
    });

    try {
      const res = await fetch(`/api/channel/${encodeURIComponent(channel.username)}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      const d = await res.json();
      if (!res.ok) {
        onStats(before);
        setError(d.error || "Couldn't save that.");
        return;
      }
      onStats({ ...before, ...d, posts: before.posts });
    } catch {
      onStats(before);
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header>
      {/* Cover. A gradient when there isn't one, never an empty grey band. */}
      <div className="relative h-36 w-full overflow-hidden sm:h-44">
        {channel.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-white/[0.10] via-white/[0.04] to-transparent" />
        )}
        {/* Sunk into the page rather than stopping at a hard line. */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="px-5">
        <div
          className="-mt-10 w-fit rounded-full ring-4 ring-background"
          style={{ viewTransitionName: `avatar-${channel.username}` }}
        >
          <Avatar src={channel.image} size={80} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="display text-2xl leading-none">{channel.displayName}</h1>
          {channel.member && (
            <span role="img" aria-label="Carz+ member" title="Carz+ member">
              <Crown
                className="h-4 w-4 text-rank-1 drop-shadow-[0_0_6px_rgba(250,204,21,0.45)]"
                strokeWidth={2}
                fill="currentColor"
                aria-hidden
              />
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] opacity-50">@{channel.username}</p>

        {channel.bio && (
          <p className="mt-3 max-w-prose whitespace-pre-wrap text-[13px] leading-relaxed opacity-80">
            {channel.bio}
          </p>
        )}

        <dl className="mt-5 flex gap-7">
          <Stat label="Videos" value={stats?.posts ?? 0} />
          <Stat label="Followers" value={stats?.followers ?? 0} />
          <Stat label="Following" value={stats?.following ?? 0} />
        </dl>

        {!channel.isYou && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={busy}
            aria-pressed={following}
            className={cn(
              "press mt-5 w-full rounded-full py-3 text-sm font-bold transition-colors disabled:opacity-60",
              following
                ? "glass-card hover:bg-white/[0.08]"
                : "bg-white text-neutral-900 hover:opacity-90",
            )}
          >
            {following ? "Following" : "Follow"}
          </button>
        )}

        {error && (
          <p role="alert" className="mt-2 text-center text-[13px] text-neon-red">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="display text-xl leading-none tabular-nums">{nf.format(value)}</dd>
      <dt className="util-label mt-1 opacity-50">{label}</dt>
    </div>
  );
}
