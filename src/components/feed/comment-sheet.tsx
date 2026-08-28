"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Trash2, Heart } from "lucide-react";
import { Spinner } from "@/components/ui/editorial";
import { timeAgo } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";

const COMMENT_MAX = 500;

type Comment = {
  id: string;
  parentId: string; // "" for a top-level comment
  userName: string;
  text: string;
  ts: number;
  youWrote: boolean;
  likeCount: number;
  likedByYou: boolean;
};

/**
 * The server returns comments already threaded — each top-level comment
 * followed by its replies — so a new reply has to land in that same order
 * rather than at the end of the list. It goes after the parent's last existing
 * reply, which is where a re-fetch would put it.
 */
function insertThreaded(list: Comment[], c: Comment): Comment[] {
  if (!c.parentId) return [...list, c];
  const parent = list.findIndex((x) => x.id === c.parentId);
  if (parent < 0) return [...list, c];
  let at = parent + 1;
  while (at < list.length && list[at].parentId === c.parentId) at++;
  return [...list.slice(0, at), c, ...list.slice(at)];
}

/**
 * Comments as a sheet over the clip rather than a separate page.
 *
 * Sitting on the bottom half means the video stays on screen — blurred by the
 * caller, so the sheet reads as being in front of it — and closing puts you
 * back exactly where you were, with the clip still playing and the scroll
 * position untouched. Navigating away lost all of that.
 */
export function CommentSheet({
  postId,
  signedIn,
  youAreAuthor = false,
  onClose,
  onCountChange,
}: {
  postId: string;
  signedIn: boolean;
  /** The post is yours, so you can clear any comment off it — not just your own. */
  youAreAuthor?: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // The comment being replied to, or null for a new top-level comment.
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (): Promise<Comment[]> => {
    const res = await fetch(`/api/feed/posts/${postId}`, { cache: "no-store" });
    const d = await res.json();
    if (!res.ok || !d.post) throw new Error(d.error || "Couldn't load comments.");
    return (d.post.comments ?? []) as Comment[];
  }, [postId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((c) => !cancelled && setComments(c))
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Escape backs out of a reply first, then closes — otherwise the only way out
  // of a mistaken Reply tap is to find the small ✕ on the chip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (replyTo) setReplyTo(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, replyTo]);

  function startReply(c: Comment) {
    // Replies collapse to one level, so replying to a reply targets its parent
    // — the same rule the store applies, mirrored here so the chip names the
    // person tapped rather than whoever started the thread.
    setReplyTo({ id: c.parentId || c.id, userName: c.userName });
    setError("");
    inputRef.current?.focus();
  }

  async function add() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const parentId = replyTo?.id;
    try {
      const res = await fetch(`/api/feed/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, ...(parentId ? { parentId } : {}) }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Couldn't post that.");
        return;
      }
      setText("");
      setReplyTo(null);
      setComments((prev) => {
        const next = insertThreaded(prev ?? [], d.comment as Comment);
        onCountChange?.(next.length);
        return next;
      });
    } catch {
      setError("Network error — your comment wasn't posted.");
    } finally {
      setSending(false);
    }
  }

  /**
   * Optimistic, and deliberately not rolled back on a failed request: the like
   * is a toggle, so a stale button corrects itself on the next tap, and
   * flipping the heart back under someone's finger reads as a bug.
   */
  async function toggleLike(commentId: string) {
    if (!signedIn) return;
    setComments((prev) =>
      (prev ?? []).map((c) =>
        c.id === commentId
          ? { ...c, likedByYou: !c.likedByYou, likeCount: c.likeCount + (c.likedByYou ? -1 : 1) }
          : c,
      ),
    );
    try {
      const res = await fetch(`/api/feed/posts/${postId}/comments/${commentId}/like`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Couldn't register that.");
        return;
      }
      // Settle on the server's count — concurrent likes from other people mean
      // the local guess can drift even when the toggle itself succeeded.
      setComments((prev) =>
        (prev ?? []).map((c) =>
          c.id === commentId ? { ...c, likedByYou: !!d.liked, likeCount: d.likeCount ?? c.likeCount } : c,
        ),
      );
    } catch {
      setError("Network error — that like didn't stick.");
    }
  }

  async function remove(commentId: string) {
    const previous = comments;
    // A top-level comment takes its replies with it, server-side; the same
    // subtraction happens here so the optimistic list matches what comes back.
    setComments((prev) => {
      const next = (prev ?? []).filter((c) => c.id !== commentId && c.parentId !== commentId);
      onCountChange?.(next.length);
      return next;
    });
    if (replyTo?.id === commentId) setReplyTo(null);
    try {
      const res = await fetch(`/api/feed/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setComments(previous);
        onCountChange?.(previous?.length ?? 0);
        setError(d.error || "Couldn't delete that comment.");
      }
    } catch {
      setComments(previous);
      onCountChange?.(previous?.length ?? 0);
      setError("Network error — the comment wasn't deleted.");
    }
  }

  return (
    <>
      {/* Covers the whole screen so the feed can't be scrolled behind the
          sheet, while leaving the blurred clip visible above it. */}
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        className="fixed inset-x-0 bottom-0 z-50 flex h-[58dvh] flex-col rounded-t-3xl border-t border-white/15 bg-card text-card-foreground shadow-[0_-16px_40px_-12px_rgba(0,0,0,0.9)]"
      >
        {/* Grabber — signals the sheet is a layer, not a page. */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-black/20" />
        </div>

        <header className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-bold">
            Comments{comments ? ` · ${comments.length}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="press flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] transition hover:bg-black/[0.12]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
          {comments === null ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          ) : comments.length === 0 ? (
            <p className="mt-6 text-center text-[13px] opacity-50">
              No comments yet — say something.
            </p>
          ) : (
            <ul className="space-y-3.5 py-1">
              {comments.map((c) => (
                <li
                  key={c.id}
                  // Replies sit indented under the comment they answer, with a
                  // hairline rule standing in for the thread they belong to.
                  className={cn(
                    "flex items-start gap-2.5",
                    c.parentId && "ml-4 border-l border-black/10 pl-3",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-bold">{c.userName}</span>
                      <span className="shrink-0 text-[11px] opacity-40">{timeAgo(c.ts)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed">
                      {c.text}
                    </p>
                    {signedIn && (
                      <button
                        type="button"
                        onClick={() => startReply(c)}
                        className="press mt-1 text-[11px] font-bold opacity-50 transition hover:opacity-100"
                      >
                        Reply
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleLike(c.id)}
                      disabled={!signedIn}
                      aria-pressed={c.likedByYou}
                      aria-label={c.likedByYou ? "Unlike comment" : "Like comment"}
                      className="press rounded-full p-1 transition hover:bg-black/[0.06] disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <Heart
                        className={cn("h-3.5 w-3.5 transition", c.likedByYou ? "opacity-100" : "opacity-40")}
                        strokeWidth={2}
                        fill={c.likedByYou ? "currentColor" : "none"}
                        aria-hidden
                      />
                    </button>
                    {/* Held open only when there's a count, so an unliked row
                        doesn't carry a stray zero. */}
                    {c.likeCount > 0 && (
                      <span className="text-[10px] tabular-nums opacity-50">{c.likeCount}</span>
                    )}
                  </div>

                  {(c.youWrote || youAreAuthor) && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      aria-label="Delete comment"
                      className="press shrink-0 rounded-full p-1.5 opacity-40 transition hover:bg-black/[0.06] hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[13px] font-medium">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-black/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {signedIn ? (
            <>
              {replyTo && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-black/[0.05] px-3 py-1.5">
                  <span className="truncate text-[11px] opacity-60">
                    Replying to <span className="font-bold">{replyTo.userName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    aria-label="Cancel reply"
                    className="press shrink-0 rounded-full p-0.5 opacity-50 transition hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
                  rows={1}
                  placeholder={replyTo ? `Reply to ${replyTo.userName}…` : "Add a comment…"}
                  className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-black/10 bg-black/[0.04] px-3 py-2.5 text-[13px] leading-relaxed outline-none transition focus:border-black/30"
                />
                <button
                  type="button"
                  onClick={add}
                  disabled={!text.trim() || sending}
                  aria-busy={sending || undefined}
                  className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-black px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {sending && <Spinner className="h-3.5 w-3.5" />}
                  {replyTo ? "Reply" : "Post"}
                </button>
              </div>
            </>
          ) : (
            <Link
              href={`/signin?callbackUrl=/feed`}
              className="press flex w-full items-center justify-center rounded-full bg-black px-5 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
            >
              Sign in to comment
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
