"use client";

/**
 * The last line of defence: a crash in the root layout itself.
 *
 * There was no boundary here, so anything that threw in the layout — the
 * shader, the nav, a provider — unmounted the entire document and left a blank
 * white page with no message, no way back and nothing to report. A route
 * boundary cannot help with that, because the route never gets to render.
 *
 * This replaces the whole document, html and body included, which is why it
 * carries its own markup and inline styles rather than any of the app's
 * classes: the stylesheet may be exactly what failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Carz AI hit a snag</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.7, marginTop: 12 }}>
            Something failed before the page could load.
          </p>
          {(error?.message || error?.digest) && (
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                opacity: 0.8,
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.08)",
                textAlign: "left",
                wordBreak: "break-word",
              }}
            >
              {error?.message}
              {error?.digest ? ` (${error.digest})` : ""}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              minHeight: 44,
              width: "100%",
              borderRadius: 999,
              border: "none",
              background: "#fff",
              color: "#000",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
