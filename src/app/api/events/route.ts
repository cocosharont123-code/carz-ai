import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const MODEL = process.env.CAR_SPOTTER_MODEL || "claude-haiku-4-5-20251001";

const TOOL = {
  name: "report_events",
  description: "Report nearby luxury and sports car events.",
  input_schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        description: "6–10 real recurring luxury/sports car events near the location.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: {
              type: "string",
              enum: ["Cars & Coffee", "Concours", "Auction", "Track day", "Car show", "Rally", "Meet"],
            },
            venue: { type: "string", description: "Venue name, or '' if unknown" },
            city: { type: "string" },
            when: { type: "string", description: "Recurrence or season, e.g. 'Every Saturday AM' or 'Every August'. Never an invented exact date." },
            note: { type: "string", description: "One short line on what it is / why it's worth it." },
          },
          required: ["name", "type", "city", "when"],
        },
      },
    },
    required: ["events"],
  },
} as const;

async function placeFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      { headers: { "User-Agent": "CarzAI/1.0 (car events)" }, next: { revalidate: 3600 } },
    );
    const d = await r.json();
    const a = d.address || {};
    return [a.city || a.town || a.village || a.county, a.state, a.country].filter(Boolean).join(", ") || d.display_name || "";
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Server has no ANTHROPIC_API_KEY.", events: [] }, { status: 500 });

  let body: { lat?: number; lng?: number; place?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let place = (body.place || "").trim();
  if (!place && typeof body.lat === "number" && typeof body.lng === "number") {
    place = await placeFromCoords(body.lat, body.lng);
  }
  if (!place) return NextResponse.json({ error: "No location provided.", events: [] }, { status: 400 });

  const prompt =
    `List 6 to 10 real, well-known recurring luxury and sports car events in or near ${place} (within roughly 150 miles): ` +
    `Cars & Coffee / supercar meets, concours d'elegance, major collector-car auctions, track days at nearby circuits, and notable annual car shows. ` +
    `For each give the name, type, venue, city, and typical timing as a recurrence or season (e.g. "Monthly", "Every Saturday AM", "Every August") — ` +
    `do NOT invent exact calendar dates. Prefer real, verifiable events and venues. Focus on luxury and sports/exotic cars.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "report_events" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "AI error", events: [], place }, { status: 502 });
    const data = await res.json();
    const block = (data.content || []).find(
      (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "report_events",
    );
    const events = block?.input?.events ?? [];
    return NextResponse.json({ place, events });
  } catch {
    return NextResponse.json({ error: "fetch failed", events: [], place }, { status: 502 });
  }
}
