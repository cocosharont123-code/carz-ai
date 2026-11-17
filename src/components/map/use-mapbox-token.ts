"use client";

import { useEffect, useState } from "react";

/**
 * The Mapbox token, for anything in the browser that needs one.
 *
 * Two sources, in order:
 *
 *  - NEXT_PUBLIC_MAPBOX_TOKEN, inlined into the bundle at build time. When a
 *    deployment sets it there is nothing to wait for.
 *  - /api/map-token otherwise, which reads it from Blob. That exists because
 *    the variable lived on one laptop and the deployed map therefore had
 *    nothing to draw with -- see map-config-blob.
 *
 * `undefined` means "not known yet" and is distinct from "" ("there isn't
 * one"): a caller that cannot tell them apart will draw its "no token" state
 * for a moment on every load.
 */
export function useMapboxToken(): string | undefined {
  const [token, setToken] = useState<string | undefined>(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined,
  );

  useEffect(() => {
    if (token !== undefined) return;
    let cancelled = false;
    fetch("/api/map-token", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { token: "" }))
      .then((d) => {
        if (!cancelled) setToken(typeof d?.token === "string" ? d.token : "");
      })
      .catch(() => {
        if (!cancelled) setToken("");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return token;
}
