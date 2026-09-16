import { put, list } from "@vercel/blob";
import { createHash } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";
// Re-exported so the route keeps importing moderation from one place, while the
// client imports the reasons from a module that carries no server deps.
export { REPORT_REASONS, isReportReason, type ReportReason } from "./report-reasons";
import type { ReportReason } from "./report-reasons";

/**
 * Blocks, saves and reports.
 *
 * Blocking and saving are private to one viewer, so both live under a hash of
 * their email in a single document — the same shape the follows store uses, and
 * for the same reason: a raw email has no business in a public blob.
 *
 * Reports are the opposite. They are addressed to whoever moderates this, so
 * they go in a list of their own, newest last, and nothing in the app reads
 * them back. Until now the app had no way to report anything at all, which for
 * something built around a public video feed is the gap that matters most.
 */

const PATH = "feed/moderation.json";

export class ModerationError extends Error {}

export type Report = {
  id: string;
  /** The post complained about. */
  postId: string;
  /** Who made the clip, so a pattern across posts is visible. */
  authorName: string;
  reason: ReportReason;
  /** Hashed, so a report can be traced to one account without naming it. */
  byHash: string;
  at: number;
};

type Viewer = {
  /** Usernames, lowercased and without the @. */
  blocked: string[];
  /** Post ids. */
  saved: string[];
};

type Store = {
  viewers: Record<string, Viewer>;
  reports: Report[];
};

const EMPTY: Store = { viewers: {}, reports: [] };

export function moderationConfigured(): boolean {
  return blobConfigured();
}

export function viewerKey(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

const handle = (username: string) => username.replace(/^@/, "").toLowerCase().trim();

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    return (blobs.find((b) => b.pathname === PATH) ?? blobs[0])?.url ?? null;
  } catch (e) {
    throw new ModerationError("Couldn't list the moderation blob.", { cause: e });
  }
}

/**
 * Throws rather than returning an empty store when the read fails. An empty
 * store would read as "nobody has blocked anyone", and the next write would
 * persist that — unblocking every account in the app at once.
 */
async function readAll(): Promise<Store> {
  const url = await currentUrl();
  if (!url) return { viewers: {}, reports: [] };
  let res: Response;
  try {
    res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  } catch (e) {
    throw new ModerationError("Couldn't reach the moderation blob.", { cause: e });
  }
  if (!res.ok) throw new ModerationError(`Moderation read failed (HTTP ${res.status}).`);
  try {
    const data = (await res.json()) as Partial<Store>;
    return {
      viewers: data?.viewers && typeof data.viewers === "object" ? data.viewers : {},
      reports: Array.isArray(data?.reports) ? data.reports : [],
    };
  } catch (e) {
    throw new ModerationError("Moderation blob is not valid JSON.", { cause: e });
  }
}

async function writeAll(store: Store): Promise<void> {
  try {
    await put(PATH, JSON.stringify(store), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      token: blobToken(),
      cacheControlMaxAge: 60,
    });
  } catch (e) {
    throw new ModerationError("Couldn't write the moderation blob.", { cause: e });
  }
}

function viewerIn(store: Store, key: string): Viewer {
  const found = store.viewers[key];
  if (found) {
    found.blocked = Array.isArray(found.blocked) ? found.blocked : [];
    found.saved = Array.isArray(found.saved) ? found.saved : [];
    return found;
  }
  const fresh: Viewer = { blocked: [], saved: [] };
  store.viewers[key] = fresh;
  return fresh;
}

/** What this viewer has hidden and kept. Empty for anyone signed out. */
export async function getViewerState(
  email: string | null | undefined,
): Promise<{ blocked: string[]; saved: string[] }> {
  if (!email || !moderationConfigured()) return { blocked: [], saved: [] };
  const store = await readAll().catch(() => EMPTY);
  const v = store.viewers[viewerKey(email)];
  return { blocked: v?.blocked ?? [], saved: v?.saved ?? [] };
}

/** Idempotent both ways. */
export async function setBlocked(
  email: string,
  username: string,
  on: boolean,
): Promise<string[]> {
  const store = await readAll();
  const v = viewerIn(store, viewerKey(email));
  const target = handle(username);
  const next = new Set(v.blocked);
  if (on) next.add(target);
  else next.delete(target);
  v.blocked = [...next];
  await writeAll(store);
  return v.blocked;
}

/** Idempotent both ways. */
export async function setSaved(email: string, postId: string, on: boolean): Promise<string[]> {
  const store = await readAll();
  const v = viewerIn(store, viewerKey(email));
  const next = new Set(v.saved);
  if (on) next.add(postId);
  else next.delete(postId);
  v.saved = [...next];
  await writeAll(store);
  return v.saved;
}

/**
 * Files a report. One per account per post — a second one replaces the first
 * rather than stacking, so a single person cannot inflate a count by tapping
 * repeatedly, and the newest reason is the one kept.
 */
export async function addReport(input: {
  email: string;
  postId: string;
  authorName: string;
  reason: ReportReason;
}): Promise<void> {
  const store = await readAll();
  const byHash = viewerKey(input.email);
  store.reports = store.reports.filter(
    (r) => !(r.postId === input.postId && r.byHash === byHash),
  );
  store.reports.push({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    postId: input.postId,
    authorName: input.authorName,
    reason: input.reason,
    byHash,
    at: Date.now(),
  });
  // Bounded: this is a blob rewritten whole on every write, so it cannot be
  // allowed to grow without limit. The oldest go first.
  if (store.reports.length > 2000) store.reports = store.reports.slice(-2000);
  await writeAll(store);
}
