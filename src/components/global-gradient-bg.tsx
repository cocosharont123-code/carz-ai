/**
 * The app background: the page gradient, with light moving over it.
 *
 * This replaces the neon WebGL shader. It is plain markup and CSS — no canvas,
 * no three.js, no animation loop, and nothing for React to re-render — so it
 * costs essentially nothing to keep on screen on every page.
 *
 * The gradient lives here rather than on `body` because `background-attachment:
 * fixed` is unreliable on iOS Safari, where it degrades to scrolling with the
 * content. A fixed layer holds still by construction.
 *
 * Everything is a sibling of the content wrapper and never an ancestor of it,
 * so no text sits inside a translucent or transformed layer and glyphs keep
 * their subpixel antialiasing.
 */
export function GlobalGradientBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="carz-bg-gradient" />
      {/* Light pooling behind thick glass: two soft lobes that drift. */}
      <div className="carz-glass-pool carz-glass-pool-a" />
      <div className="carz-glass-pool carz-glass-pool-b" />
      {/* The specular streak you get across a sheet of glass, sweeping. */}
      <div className="carz-glass-sheen" />
    </div>
  );
}
