import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getProfile, isMaxMember } from "@/lib/profile-blob";
import { readEvents, writeEvents, fresh, type CarEvent } from "@/lib/events-blob";

export const runtime = "nodejs";
export const maxDuration = 45;

// Its own variable, and the cheapest model. It read CAR_SPOTTER_MODEL, which
// is Spot's -- pointing that at a different model for the identification
// pipeline silently retargeted this too.
const MODEL = process.env.CAR_EVENTS_MODEL || "claude-haiku-5-5";

/**
 * The place this browser last looked at, so Home can show events without
 * asking for a location of its own.
 *
 * A place name, not coordinates: it is what the model is prompted with, it is
 * already shown on screen, and a city is not a position. Six months, because
 * the answer to "where do you look at cars" does not change often, and
 * lax: it only decides which cached list to show.
 */
const PLACE_COOKIE = "carz_place";
const PLACE_MAX_AGE = 60 * 60 * 24 * 180;

/** Somewhere to start before anybody has looked anything up. */
const DEFAULT_PLACE = "Miami, Florida";

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

// Carz MAX only. Checked against the stored profile rather than anything the
// client sent, and on every request, so a lapsed membership stops working at
// once. Until now the menu showed a members badge on this and the route was
// open to anyone who knew the URL.
async function requireMax() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in to see events.", events: [] }, { status: 401 });
  }
  if (!isMaxMember(await getProfile(email))) {
    return NextResponse.json(
      { error: "Events are a Carz MAX feature.", events: [] },
      { status: 402 },
    );
  }
  return null;
}

/**
 * What we already know, for Home.
 *
 * Reads the cache and nothing else -- no model call, no location prompt, so
 * Home can render real events on arrival rather than a card inviting you to
 * go and look for some. Empty when this browser has never resolved a place
 * and the default city has not been generated yet; Home falls back to its
 * own card on an empty answer.
 */
export async function GET() {
  const denied = await requireMax();
  if (denied) return denied;

  const place = (await cookies()).get(PLACE_COOKIE)?.value?.trim() || DEFAULT_PLACE;
  const cached = await readEvents(place);
  if (!cached) return NextResponse.json({ place, events: [], cached: false });

  // Stale is still worth showing -- these recur -- and the refresh happens
  // behind the response rather than in front of it.
  if (!fresh(cached.at) && process.env.ANTHROPIC_API_KEY) {
    const key = process.env.ANTHROPIC_API_KEY;
    after(async () => {
      const events = await generate(place, key);
      if (events.length) await writeEvents(place, events);
    });
  }
  return NextResponse.json({ place: cached.place, events: cached.events, cached: true });
}

/** Ask the model. Empty array on any failure -- the caller decides what that means. */
async function generate(place: string, key: string): Promise<CarEvent[]> {
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
    if (!res.ok) return [];
    const data = await res.json();
    const block = (data.content || []).find(
      (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "report_events",
    );
    const events = block?.input?.events;
    return Array.isArray(events) ? (events as CarEvent[]) : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const denied = await requireMax();
  if (denied) return denied;

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

  // Remember where this browser is looking, so Home can show the same list
  // without a location prompt of its own.
  const jar = await cookies();
  jar.set(PLACE_COOKIE, place, {
    maxAge: PLACE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  });

  // A list we already have beats a two-second wait for the same answer.
  const cached = await readEvents(place);
  if (cached && fresh(cached.at)) {
    return NextResponse.json({ place: cached.place, events: cached.events, cached: true });
  }
  if (cached) {
    after(async () => {
      const refreshed = await generate(place, key);
      if (refreshed.length) await writeEvents(place, refreshed);
    });
    return NextResponse.json({ place: cached.place, events: cached.events, cached: true, stale: true });
  }

  const events = await generate(place, key);
  if (events.length === 0) {
    return NextResponse.json({ error: "AI error", events: [], place }, { status: 502 });
  }
  await writeEvents(place, events);
  return NextResponse.json({ place, events });
}
