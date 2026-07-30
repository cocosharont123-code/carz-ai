/**
 * Resolve the Vercel Blob read/write token.
 *
 * Vercel injects `BLOB_READ_WRITE_TOKEN` for the project's *default* Blob store,
 * but a custom-named or secondary store gets a *prefixed* variable instead
 * (e.g. `CARZ_READ_WRITE_TOKEN`). The `@vercel/blob` SDK only auto-reads the
 * default name, so a prefixed token makes the whole app report "not configured".
 *
 * This resolves whichever token is present so storage works regardless of the
 * store's name. Pass the result explicitly to `put`/`list` as `{ token }`.
 */
const PREFIX = "vercel_blob_rw_";

// A real Blob token, or undefined. Applying the same check to the default name
// as to the prefixed ones matters: a placeholder or half-pasted
// `BLOB_READ_WRITE_TOKEN` would otherwise report as configured, and every read
// would then fail as a storage *outage* ("temporarily unavailable") rather than
// the accurate "not configured yet".
function valid(value: string | undefined): string | undefined {
  const token = value?.trim();
  return token?.startsWith(PREFIX) ? token : undefined;
}

export function blobToken(): string | undefined {
  const direct = valid(process.env.BLOB_READ_WRITE_TOKEN);
  if (direct) return direct;
  // Sorted so a project with several stores resolves the same token every time;
  // `process.env` enumeration order is not guaranteed.
  for (const key of Object.keys(process.env).sort()) {
    if (!key.endsWith("_READ_WRITE_TOKEN")) continue;
    const token = valid(process.env[key]);
    if (token) return token;
  }
  return undefined;
}

export function blobConfigured(): boolean {
  return !!blobToken();
}
