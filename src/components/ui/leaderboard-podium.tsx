"use client"

import * as React from "react"
import { Crown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The top three, on a podium.
 *
 * Written to the API `leaderboard-card.tsx` calls it with, because the card was
 * supplied without it. If the original turns up, this can be replaced wholesale
 * — nothing else imports it.
 *
 * The gold/silver/bronze come from --color-rank-1/2/3, which were already in
 * globals.css under a comment naming this component's sibling.
 */

export interface LeaderboardRanking {
  userId: string
  userName: string
  rank: number
  value: number
  avatarUrl?: string
}

// Fixed locale rather than the visitor's: these render on the server too, and a
// number formatted two ways is a hydration mismatch.
const nf = new Intl.NumberFormat("en-US")

const RANK_STYLE: Record<number, { ring: string; text: string; height: string }> = {
  1: { ring: "ring-rank-1", text: "text-rank-1", height: "h-24" },
  2: { ring: "ring-rank-2", text: "text-rank-2", height: "h-16" },
  3: { ring: "ring-rank-3", text: "text-rank-3", height: "h-12" },
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

function PodiumPlace({ entry }: { entry: LeaderboardRanking }) {
  const style = RANK_STYLE[entry.rank] ?? RANK_STYLE[3]

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      {entry.rank === 1 && (
        <Crown className="mb-1 h-5 w-5 text-rank-1" strokeWidth={2} aria-hidden />
      )}

      <span
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold ring-2",
          style.ring,
        )}
      >
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.avatarUrl}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials(entry.userName)
        )}
      </span>

      <span className="mt-2 w-full truncate px-1 text-center text-xs font-semibold">
        {entry.userName}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{nf.format(entry.value)}</span>

      {/* The block itself. Height carries the ranking, so the shape reads
          before any of the text does. */}
      <div
        className={cn(
          "mt-2 flex w-full items-start justify-center rounded-t-xl border border-b-0 bg-muted/40 pt-2",
          style.height,
        )}
      >
        <span className={cn("text-lg font-bold tabular-nums", style.text)}>{entry.rank}</span>
      </div>
    </div>
  )
}

export function LeaderboardPodium({
  rankings,
  className,
}: {
  rankings: LeaderboardRanking[]
  className?: string
}) {
  // Second, first, third — the way a podium is actually arranged.
  const byRank = React.useMemo(() => {
    const find = (r: number) => rankings.find((x) => x.rank === r)
    return [find(2), find(1), find(3)].filter(Boolean) as LeaderboardRanking[]
  }, [rankings])

  if (byRank.length === 0) return null

  return (
    <div className={cn("flex items-end justify-center gap-2 sm:gap-4", className)}>
      {byRank.map((entry) => (
        <PodiumPlace key={entry.userId} entry={entry} />
      ))}
    </div>
  )
}
