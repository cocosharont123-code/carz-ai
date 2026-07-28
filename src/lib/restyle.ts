/**
 * AI photo restyle for a spotted car. Takes the photo the user took and edits
 * it — new paint, new rims, added mods — while keeping the same car, angle and
 * background. Uses Google's Gemini image model over REST (no SDK, matching the
 * identify flow). Requires GEMINI_API_KEY; RESTYLE_MODEL overrides the model.
 */

const MODEL = process.env.RESTYLE_MODEL || "gemini-2.5-flash-image";

export function restyleConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export interface RestyleOptions {
  make?: string;
  model?: string;
  yearRange?: string;
  bodyColor?: string; // e.g. "Miami blue"
  rimColor?: string; // e.g. "gloss black"
  features?: string[]; // free-text mod phrases
}

/** Turn the picked options into a precise photo-edit instruction. */
export function buildRestylePrompt(o: RestyleOptions): string {
  const car = [o.yearRange, o.make, o.model].filter(Boolean).join(" ") || "car";
  const changes: string[] = [];
  if (o.bodyColor) changes.push(`repaint the body in ${o.bodyColor}`);
  if (o.rimColor) changes.push(`change the wheels/rims to ${o.rimColor}`);
  for (const f of o.features ?? []) if (f) changes.push(f);
  const changeText = changes.length ? changes.join("; ") : "subtly enhance the car";
  // Kept short on purpose — a concise instruction prefills faster.
  return (
    `Edit this photo of a ${car}: ${changeText}. Keep the same car, angle, ` +
    `background and lighting; change only what's listed. Photorealistic, no text or watermarks.`
  );
}

export interface RestyleResult {
  mediaType: string;
  base64: string;
}

export async function restyleCar(
  mediaType: string,
  base64Data: string,
  opts: RestyleOptions,
): Promise<RestyleResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mediaType, data: base64Data } },
            { text: buildRestylePrompt(opts) },
          ],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`image model error ${res.status}: ${text.slice(0, 280)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) {
      return { mediaType: inline.mimeType ?? inline.mime_type ?? "image/png", base64: inline.data };
    }
  }
  throw new Error("the image model didn't return an image — try different options");
}
