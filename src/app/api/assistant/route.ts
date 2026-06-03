import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CAR_SPOTTER_MODEL || "claude-sonnet-4-6";
const SYSTEM =
  "You are Car Spotter's friendly expert car assistant. Answer questions about cars: " +
  "makes, models, specs, history, reliability, market values, comparisons, ownership and " +
  "buying advice. Be concise, accurate and conversational. If a question is unrelated to " +
  "cars, gently steer it back to cars.";

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server has no ANTHROPIC_API_KEY set." }, { status: 500 });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: Msg[] = raw
    .filter(
      (m): m is Msg =>
        !!m &&
        ((m as Msg).role === "user" || (m as Msg).role === "assistant") &&
        typeof (m as Msg).content === "string" &&
        (m as Msg).content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-20);

  if (!messages.length) {
    return NextResponse.json({ error: "no messages" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, messages }),
    });
    if (!res.ok) {
      const d = await res.text();
      return NextResponse.json({ error: `Anthropic ${res.status}: ${d.slice(0, 300)}` }, { status: 502 });
    }
    const data = await res.json();
    const reply = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ reply: reply || "(no response)" });
  } catch {
    return NextResponse.json({ error: "request failed" }, { status: 502 });
  }
}
