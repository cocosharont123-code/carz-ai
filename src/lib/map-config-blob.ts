import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * The Mapbox token, as runtime configuration.
 *
 * Three ways to give an app a token, and the first two did not work here:
 *
 *  - NEXT_PUBLIC_MAPBOX_TOKEN is inlined into the client bundle when the app
 *    *compiles*. It existed in one laptop's .env.local, so the local map drew
 *    and the deployed one said "Map is off": the build had nothing to inline.
 *    It still wins when it is set -- see the route that reads this.
 *  - Committing the token was the obvious fix, and GitHub's push protection
 *    refused it. It is right to: a repository is not where tokens live, even
 *    public ones, because rotating then means a commit and a deploy.
 *  - So it lives in Blob, which is already configured on the deployment and is
 *    where everything else in this app that outlives a request is kept. It is
 *    read on the server and handed to the map by /api/map-token.
 *
 * None of this is secrecy. A `pk.` token is a public token: Mapbox GL runs in
 * the browser, so whatever token the map uses is downloaded by every visitor
 * and readable in devtools. That is the design, and it is why Mapbox secures
 * these with URL restrictions in the dashboard rather than by hiding them.
 * What this does buy is one place to change it -- no commit, no rebuild, and
 * nothing to redact out of git history later.
 */

const PATH = "config/mapbox.json";

type MapConfig = { token: string; updatedAt: number };

/** Cached per warm instance: the token changes on the order of never. */
let cache: { at: number; token: string } | null = null;
const TTL_MS = 10 * 60 * 1000;

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    return blobs.find((b) => b.pathname === PATH)?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * The token to draw with, or "".
 *
 * The environment first, so a deployment that sets NEXT_PUBLIC_MAPBOX_TOKEN
 * keeps using it and this is never consulted.
 */
export async function readMapboxToken(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (!blobConfigured()) return "";
  if (cache && Date.now() - cache.at < TTL_MS) return cache.token;

  const url = await currentUrl();
  if (!url) return "";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json()) as Partial<MapConfig>;
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (token) cache = { at: Date.now(), token };
    return token;
  } catch {
    return "";
  }
}

/** Store a token. Used by the setup script, not by the app at runtime. */
export async function writeMapboxToken(token: string): Promise<void> {
  if (!blobConfigured()) throw new Error("Blob storage is not configured.");
  await put(PATH, JSON.stringify({ token, updatedAt: Date.now() } satisfies MapConfig), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    token: blobToken(),
  });
  cache = null;
}
