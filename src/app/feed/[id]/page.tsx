"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Trash2, Heart, X } from "lucide-react";
import { Skeleton, Spinner } from "@/components/ui/editorial";
import { Avatar } from "@/components/default-avatar";
import { LikeButton, timeAgo, type FeedPostView } from "@/components/feed/post-card";
import { FeedVideo } from "@/components/feed/feed-video";
import { ShareButton } from "@/components/feed/share-button";
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
 * Keep a new reply in the server's threaded order — directly after the
 * parent's last existing reply — rather than at the end of the list.
 */
function insertThreaded(list: Comment[], c: Comment): Comment[] {
  if (!c.parentId) return [...list, c];
  const parent = list.findIndex((x) => x.id === c.parentId);
  if (parent < 0) return [...list, c];
  let at = parent + 1;
  while (at < list.length && list[at].parentId === c.parentId) at++;
  return [...list.slice(0, at), c, ...list.slice(at)];
}

type PostDetail = FeedPostView & { comments: Comment[] };

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { status: authStatus } = useSession();
  const signedIn = authStatus === "authenticated";

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  // The comment being replied to, or null for a new top-level comment.
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string } | null>(null);

  // Pure fetch — returns the post (or null when it's gone) without writing
  // state, so nothing is set synchronously inside the effect below.
  const load = useCallback(async (): Promise<PostDetail | null> => {
    const res = await fetch(`/api/feed/posts/${id}`, { cache: "no-store" });
    const d = await res.json();
    if (res.status === 404 || !d.post) return null;
    return { ...d.post, comments: d.post.comments ?? [] };
  }, [id]);

  useEffect(() => {
    load()
      .then((p) => (p ? setPost(p) : setMissing(true)))
      .catch(() => setError("Couldn't load this post."))
      .finally(() => setLoading(false));
  }, [load, authStatus]);

  async function addComment() {
    const body = text.trim();
    if (!body || sending) return;
    setError("");
    setSending(true);
    const parentId = replyTo?.id;
    try {
      const res = await fetch(`/api/feed/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, ...(parentId ? { parentId } : {}) }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Couldn't post that comment.");
        return;
      }
      setText("");
      setReplyTo(null);
      setPost((p) =>
        p
          ? {
              ...p,
              comments: insertThreaded(p.comments, d.comment as Comment),
              commentCount: p.commentCount + 1,
            }
          : p,
      );
    } catch {
      setError("Network error — your comment wasn't posted.");
    } finally {
      setSending(false);
    }
  }

  /**
   * Optimistic, and not rolled back on failure: a like is a toggle, so a stale
   * heart corrects itself on the next tap, and flipping it back under someone's
   * finger reads as a bug.
   */
  async function toggleCommentLike(commentId: string) {
    if (!signedIn) return;
    const apply = (fn: (c: Comment) => Comment) =>
      setPost((p) => (p ? { ...p, comments: p.comments.map((c) => (c.id === commentId ? fn(c) : c)) } : p));

    apply((c) => ({
      ...c,
      likedByYou: !c.likedByYou,
      likeCount: c.likeCount + (c.likedByYou ? -1 : 1),
    }));
    try {
      const res = await fetch(`/api/feed/posts/${id}/comments/${commentId}/like`, { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Couldn't register that.");
        return;
      }
      // Settle on the server's count — other people's likes land in between.
      apply((c) => ({ ...c, likedByYou: !!d.liked, likeCount: d.likeCount ?? c.likeCount }));
    } catch {
      setError("Network error — that like didn't stick.");
    }
  }

  async function removeComment(commentId: string) {
    // Optimistic: drop it, restore on failure.
    const previous = post;
    // A top-level comment takes its replies with it, server-side; the same
    // subtraction happens here so the optimistic list matches what comes back.
    setPost((p) => {
      if (!p) return p;
      const comments = p.comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
      return {
        ...p,
        comments,
        commentCount: Math.max(0, p.commentCount - (p.comments.length - comments.length)),
      };
    });
    if (replyTo?.id === commentId) setReplyTo(null);
    try {
      const res = await fetch(`/api/feed/posts/${id}/comments/${commentId}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setPost(previous);
        setError(d.error || "Couldn't delete that comment.");
      }
    } catch {
      setPost(previous);
      setError("Network error — the comment wasn't deleted.");
    }
  }

  async function removePost() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/feed/posts/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Couldn't delete this post.");
        setDeleting(false);
        return;
      }
      router.push("/feed");
      router.refresh();
    } catch {
      setError("Network error — the post wasn't deleted.");
      setDeleting(false);
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-5 py-10">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-60 transition hover:opacity-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Feed
        </Link>

        {loading ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-card p-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="mt-3 aspect-[4/3] w-full" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </div>
        ) : missing ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <h1 className="text-lg font-bold">This post is gone</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
              It may have been deleted by whoever posted it.
            </p>
            <Link
              href="/feed"
              className="press mt-5 inline-flex rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              Back to feed
            </Link>
          </div>
        ) : post ? (
          <>
            <article className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-card text-card-foreground">
              <header className="flex items-center gap-2.5 px-4 py-3">
                <Avatar src={post.authorImage} size={30} />
                <span className="truncate text-[13px] font-bold">{post.authorName}</span>
                <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide opacity-50">
                  {timeAgo(post.createdAt)}
                </span>
              </header>

              {post.mediaKind === "video" && post.videoUrl ? (
                <FeedVideo
                  videoUrl={post.videoUrl}
                  posterUrl={post.imageUrl}
                  edit={post.edit}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={post.imageUrl}
                  alt={post.caption ? post.caption.slice(0, 120) : "A car posted to the feed"}
                  className="aspect-[4/3] w-full bg-black/5 object-cover"
                />
              )}

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
                    onChange={(liked, count) =>
                      setPost((p) => (p ? { ...p, likedByYou: liked, likeCount: count } : p))
                    }
                  />
                  <span className="rounded-full bg-black/[0.06] px-3 py-1.5 text-[13px] font-semibold">
                    {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
                  </span>
                  <ShareButton postId={post.id} caption={post.caption} />

                  {post.youAreAuthor && (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="press ml-auto inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3 py-1.5 text-[13px] font-semibold transition hover:bg-black/[0.1]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  )}
                </div>

                {confirmingDelete && (
                  <div className="mt-3 rounded-2xl border border-black/15 bg-black/[0.04] p-3.5">
                    <p className="text-[13px] font-bold">Delete this post?</p>
                    <p className="mt-1 text-[13px] opacity-70">
                      The photo and every comment on it go with it. This can&apos;t be undone.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={removePost}
                        disabled={deleting}
                        aria-busy={deleting || undefined}
                        className="press inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {deleting && <Spinner className="h-3.5 w-3.5" />}
                        {deleting ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleting}
                        className="press rounded-full border border-black/20 px-5 py-2 text-[13px] font-semibold transition hover:border-black/40 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* --- Comments --- */}
            <section className="mt-5 rounded-3xl border border-white/10 bg-card text-card-foreground p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wide opacity-50">Comments</h2>

              {post.comments.length === 0 ? (
                <p className="mt-3 text-[13px] opacity-50">No comments yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {post.comments.map((c) => (
                    <li
                      key={c.id}
                      // Replies sit indented under the comment they answer,
                      // with a hairline rule standing in for the thread.
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
                            // Replies collapse to one level, matching the store:
                            // replying to a reply targets its parent.
                            onClick={() => setReplyTo({ id: c.parentId || c.id, userName: c.userName })}
                            className="press mt-1 text-[11px] font-bold opacity-50 transition hover:opacity-100"
                          >
                            Reply
                          </button>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleCommentLike(c.id)}
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
                        {/* Held open only when there's a count, so an unliked
                            row doesn't carry a stray zero. */}
                        {c.likeCount > 0 && (
                          <span className="text-[10px] tabular-nums opacity-50">{c.likeCount}</span>
                        )}
                      </div>

                      {(c.youWrote || post.youAreAuthor) && (
                        <button
                          type="button"
                          onClick={() => removeComment(c.id)}
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

              {signedIn ? (
                <div className="mt-4 border-t border-black/10 pt-4">
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
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
                    rows={2}
                    placeholder={replyTo ? `Reply to ${replyTo.userName}…` : "Add a comment…"}
                    className="w-full resize-none rounded-2xl border border-black/10 bg-black/[0.03] p-3 text-[13px] leading-relaxed outline-none transition focus:border-black/30"
                  />
                  <button
                    type="button"
                    onClick={addComment}
                    disabled={!text.trim() || sending}
                    aria-busy={sending || undefined}
                    className="press mt-2 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {sending && <Spinner className="h-3.5 w-3.5" />}
                    {sending ? "Posting…" : replyTo ? "Reply" : "Comment"}
                  </button>
                </div>
              ) : (
                <div className="mt-4 border-t border-black/10 pt-4">
                  <Link
                    href={`/signin?callbackUrl=/feed/${id}`}
                    className="press inline-flex rounded-full bg-black px-5 py-2 text-[13px] font-bold text-white transition hover:opacity-90"
                  >
                    Sign in to comment
                  </Link>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-black/15 bg-black/[0.05] p-3 text-[13px] font-medium"
                >
                  {error}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
