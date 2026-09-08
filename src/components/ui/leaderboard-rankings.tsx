"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The ranked list under the podium.
 *
 * Written to the API `leaderboard-card.tsx` calls it with — `rankings`,
 * `currentUserId`, `showPagination`, `defaultPageSize` — because the card was
 * supplied without it. Replaceable wholesale if the original turns up.
 *
 * globals.css already carried --color-rank-1/2/3 under a comment naming this
 * file, so the top three take those colours.
 */

export interface LeaderboardRankingItem {
  userId: string
  rank: number
  userName: string
  byline?: string
  value: number
  /** Rows are hidden when this is explicitly false. */
  displayed?: boolean
  avatarUrl?: string
}

// Fixed locale: these render on the server too, and a number formatted two ways
// is a hydration mismatch.
const nf = new Intl.NumberFormat("en-US")

const RANK_TEXT: Record<number, string> = {
  1: "text-rank-1",
  2: "text-rank-2",
  3: "text-rank-3",
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

export function LeaderboardRankings({
  rankings,
  currentUserId,
  showPagination = false,
  defaultPageSize = 10,
  className,
}: {
  rankings: LeaderboardRankingItem[]
  currentUserId?: string
  showPagination?: boolean
  defaultPageSize?: number
  className?: string
}) {
  const rows = React.useMemo(
    () => rankings.filter((r) => r.displayed !== false),
    [rankings],
  )

  const pageSize = showPagination ? Math.max(1, defaultPageSize) : rows.length
  const pageCount = Math.max(1, Math.ceil(rows.length / Math.max(1, pageSize)))
  const [page, setPage] = React.useState(0)

  // Adjust during render rather than in an effect: if the list shrinks under
  // the current page, the page number is stale the moment it is read, and
  // fixing it afterwards renders one frame of nothing. This is React's
  // documented pattern for state derived from changed props.
  const [lastPageCount, setLastPageCount] = React.useState(pageCount)
  if (lastPageCount !== pageCount) {
    setLastPageCount(pageCount)
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1))
  }

  const start = showPagination ? page * pageSize : 0
  const visible = showPagination ? rows.slice(start, start + pageSize) : rows

  if (rows.length === 0) {
    return (
      <p className={cn("text-muted-foreground py-6 text-center text-sm", className)}>
        No rankings yet.
      </p>
    )
  }

  return (
    <div className={className}>
      <ol className="space-y-1">
        {visible.map((row) => {
          const isYou = !!currentUserId && row.userId === currentUserId
          return (
            <li
              key={row.userId}
              aria-current={isYou ? "true" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                isYou ? "bg-primary/10 ring-primary/30 ring-1" : "hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "w-6 shrink-0 text-center text-sm font-bold tabular-nums",
                  RANK_TEXT[row.rank] ?? "text-muted-foreground",
                )}
              >
                {row.rank}
              </span>

              <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold">
                {row.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(row.userName)
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.userName}</span>
                {row.byline && (
                  <span className="text-muted-foreground block truncate text-xs">{row.byline}</span>
                )}
              </span>

              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {nf.format(row.value)}
              </span>
            </li>
          )
        })}
      </ol>

      {showPagination && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <span className="text-muted-foreground text-xs tabular-nums">
            Page {page + 1} of {pageCount}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            aria-label="Next page"
            className="hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
