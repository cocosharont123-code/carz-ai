import sharp from "sharp";

/**
 * Stamps a render as Carz AI.
 *
 * Server-side on purpose. An overlay drawn in the page would be absent from the
 * file itself, and the file is the thing that gets saved, posted and sent on —
 * which is the only place a watermark does any work.
 *
 * The mark is the wave from the app icon plus the name. The wave is drawn as
 * plain strokes rather than text so it does not depend on a font being
 * installed in the runtime: if the server has no fonts and the label fails to
 * render, the render is still visibly marked.
 */

const MARK_FRACTION = 0.28; // of the image's width
const MIN_MARK_PX = 120;
const PAD_FRACTION = 0.22; // of the mark's width, as breathing room from the edge

function markSvg(markW: number): string {
  const w = Math.round(markW);
  const pad = Math.round(w * PAD_FRACTION);
  const waveH = Math.round(w * 0.2);
  const textY = waveH + Math.round(w * 0.17);
  const font = Math.round(w * 0.16);
  const stroke = Math.max(2, Math.round(w * 0.032));
  const boxW = w + pad;
  const boxH = textY + Math.round(font * 0.35) + pad;

  // One wave splitting into three, the same shape the icon carries.
  const path = (dy: number) =>
    `M ${w * 0.04} ${waveH * 0.42} C ${w * 0.3} ${waveH * 0.42}, ${w * 0.34} ${waveH * 0.9 + dy}, ${w * 0.62} ${waveH * 0.9 + dy} S ${w * 0.86} ${waveH * 0.2 + dy}, ${w * 0.96} ${waveH * 0.2 + dy}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}" viewBox="0 0 ${boxW} ${boxH}">
  <g opacity="0.88" transform="translate(0,${Math.round(pad * 0.2)})" fill="none" stroke-linecap="round">
    <path d="${path(waveH * 0.22)}" stroke="#ff3131" stroke-width="${stroke}"/>
    <path d="${path(0)}" stroke="#39ff14" stroke-width="${stroke}"/>
    <path d="${path(-waveH * 0.22)}" stroke="#00e5ff" stroke-width="${stroke}"/>
  </g>
  <text x="${w * 0.04}" y="${textY}" font-family="sans-serif" font-size="${font}" font-weight="700"
        fill="#ffffff" opacity="0.92" letter-spacing="${font * 0.02}"
        style="paint-order:stroke" stroke="#000000" stroke-width="${Math.max(1, stroke * 0.5)}" stroke-opacity="0.45">Carz AI</text>
</svg>`;
}

export type Stamped = { base64: string; mediaType: string };

/**
 * Returns the image with the mark composited into the bottom-right corner, in
 * the format it arrived in — the caller turns it straight back into a data URL,
 * and changing the type underneath it would be a surprise.
 */
export async function watermark(base64: string, mediaType: string): Promise<Stamped> {
  const input = Buffer.from(base64, "base64");
  const image = sharp(input);
  const meta = await image.metadata();
  const width = meta.width ?? 1024;

  const markW = Math.max(MIN_MARK_PX, Math.round(width * MARK_FRACTION));
  const svg = Buffer.from(markSvg(markW));

  const composited = image.composite([{ input: svg, gravity: "southeast" }]);
  const out =
    mediaType === "image/jpeg" || mediaType === "image/jpg"
      ? await composited.jpeg({ quality: 92 }).toBuffer()
      : await composited.png({ compressionLevel: 9 }).toBuffer();

  return {
    base64: out.toString("base64"),
    mediaType: mediaType === "image/jpeg" || mediaType === "image/jpg" ? "image/jpeg" : "image/png",
  };
}
