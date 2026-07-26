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
export function blobToken(): string | undefined {
  const direct = process.env.BLOB_READ_WRITE_TOKEN;
  if (direct) return direct;
  for (const [key, value] of Object.entries(process.env)) {
    // Vercel Blob tokens are `vercel_blob_rw_...`; match any *_READ_WRITE_TOKEN.
    if (value && key.endsWith("_READ_WRITE_TOKEN") && value.startsWith("vercel_blob_rw_")) {
      return value;
    }
  }
  return undefined;
}

export function blobConfigured(): boolean {
  return !!blobToken();
}
