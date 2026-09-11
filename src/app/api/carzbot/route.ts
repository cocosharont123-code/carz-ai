import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { getProfile, memberTier } from "@/lib/profile-blob";

export const runtime = "nodejs";
export const maxDuration = 60;

// Conversation about cars is recall, not perception — there is no photo to
// reason over — so it takes the cheapest model, same as the spec sheet and
// Drops. CARZBOT_MODEL overrides it without a deploy.
const MODEL = process.env.CARZBOT_MODEL || "claude-haiku-4-5";

// Kept short deliberately: this is a chat bubble, not an essay, and output
// tokens are what a conversation actually costs.
const MAX_TOKENS = 700;

const SYSTEM =
  "You are CarzBot, the assistant inside Carz AI — an app for spotting, identifying and valuing cars. " +
  "Answer questions about cars: models, specs, history, reliability, what something is worth, what to look for when buying, how to tell two similar cars apart. " +
  "Be direct and specific. Two or three short paragraphs at most, and prefer concrete numbers over hedging. " +
  "If a question needs a photo to answer — 'what car is this' — say so and point them at the Spot tab, which identifies a car from a picture. " +
  "If you are not confident about a figure, say which part you are unsure of rather than rounding it into a claim. " +
  "Politely decline anything that isn't about cars or this app.";

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "CarzBot isn't configured yet." }, { status: 503 });
  }

  // CarzBot is a paid feature in both tiers. It was open to everyone and
  // unmetered, which is a bill rather than a feature.
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in to use CarzBot." }, { status: 401 });
  }
  if (!memberTier(await getProfile(email))) {
    return NextResponse.json({ error: "CarzBot is a Carz+ feature." }, { status: 402 });
  }

  let body: { messages?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Trust the shape, not the sender: only the two roles, only strings, and only
  // the tail — an unbounded history is an unbounded bill.
  const messages = (body.messages ?? [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });
  }

  try {
    const res = await new Anthropic({ apiKey: key }).messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages,
    });

    if (res.stop_reason === "refusal") {
      return NextResponse.json({ reply: "I can't help with that one." });
    }

    const reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ reply: reply || "I didn't catch that — try asking again." });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Busy right now — try again in a moment." }, { status: 429 });
    }
    console.error("carzbot failed:", e);
    return NextResponse.json({ error: "CarzBot couldn't answer that." }, { status: 502 });
  }
}
