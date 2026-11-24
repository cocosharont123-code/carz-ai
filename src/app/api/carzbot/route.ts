import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { getProfile, memberTier } from "@/lib/profile-blob";
import { takeAiCall } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Conversation about cars is recall, not perception — there is no photo to
// reason over — so it takes the cheapest model, same as the spec sheet.
//
// Haiku 5.5 rather than 4.5: $0.10 per million input tokens against $1, and
// $0.50 out against $5, for the same job. Drops is still on 4.5 and is the
// next one to move. CARZBOT_MODEL overrides it without a deploy.
const MODEL = process.env.CARZBOT_MODEL || "claude-haiku-5-5";

// Kept short deliberately: this is a chat bubble, not an essay, and output
// tokens are what a conversation actually costs.
const MAX_TOKENS = 700;

/**
 * The answer's shape, not just its subject.
 *
 * The old prompt asked for "two or three short paragraphs", which is how a
 * chat bubble fills with preamble: the model would set the scene, answer, and
 * then summarise what it had just said. The answer goes first now, and the
 * rest is allowed to exist only if it supports it.
 *
 * The formatting clauses are real instructions rather than decoration: the
 * client renders markdown, so bold, bullets and pipe tables arrive as bold,
 * bullets and tables. Saying which to use when is what stops a two-car
 * comparison coming back as six paragraphs the reader has to diff by eye.
 */
const SYSTEM =
  "You are CarzBot, the assistant inside Carz AI — an app for spotting, identifying and valuing vehicles. " +
  "Answer questions about anything that moves under its own power and the world around it: cars, motorcycles, trucks and vans, boats and jet skis, aircraft, electric and hybrid vehicles, karts, campers, tractors and heavy machinery. " +
  "Models, specs, history, reliability, what something is worth, what to look for when buying, running costs, maintenance, racing, the industry, and how to tell two similar machines apart. " +
  "A question about a motorcycle, a boat or a plane is as much yours as one about a car — the app is named for cars, you are not limited to them. " +
  "\n\nHOW TO ANSWER\n" +
  "Lead with the direct answer in one or two sentences. Then, only if it genuinely helps, a few short supporting details. " +
  "No preamble, no restating the question, no closing summary, no offers of further help — the reader can simply ask again. " +
  "Prefer concrete numbers over hedging, and never pad to seem thorough. " +
  "\n\nFORMATTING\n" +
  "Your reply is rendered as markdown. Use **bold** for the numbers and model names that carry the answer. " +
  "Use a bullet list only for specs or a genuine list of items, never for prose. " +
  "When comparing two or more cars, use a markdown table with one column per car and one row per attribute. " +
  "Use short paragraphs; never a wall of text. No headings unless the answer really has sections. " +
  "\n\nLIMITS\n" +
  "If a question needs a photo to answer — 'what is this one' — say so and point them at the Spot tab, which identifies a vehicle from a picture. " +
  "If you are not confident about a figure, say which part you are unsure of rather than rounding it into a claim. " +
  "Decline only what is genuinely nothing to do with vehicles, machines that move, or this app — and do it in one short line, without a lecture.";

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
    return NextResponse.json({ error: "CarzBot is a Carz PRO feature." }, { status: 402 });
  }

  /**
   * A burst limit, which CarzBot had none of.
   *
   * Its only 429 was Anthropic's own rate-limit error relayed back, which fires
   * when the account's limit is hit -- so the first thing that noticed one person
   * hammering it was every other person's conversation breaking. Being a paid
   * feature caps who can call it, not how fast.
   *
   * No daily cap: membership is sold as asking anything about cars, and a
   * conversation that stops at message forty is not that. The window stops a
   * loop, not a long chat.
   */
  const gate = await takeAiCall("carzbot", email, null);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Too many messages at once — give it a few seconds." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
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

  /**
   * The answer streams.
   *
   * It used to be one messages.create and a JSON body, which meant the bubble
   * sat empty for as long as the whole answer took to generate and then
   * appeared at once. Every gate above still answers with JSON and a status
   * code, because they all fail before a single token exists; once the model
   * starts talking the response is plain text and the client appends it.
   *
   * Plain text rather than SSE framing: there is one stream of one thing here,
   * and `data:` prefixes would only be something for both ends to strip.
   */
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages,
    });

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encode = new TextEncoder();
        let wrote = false;
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              event.delta.text
            ) {
              wrote = true;
              controller.enqueue(encode.encode(event.delta.text));
            }
          }
          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") {
            // Nothing was streamed in this case -- a refusal stops before any
            // text block -- so this is the whole reply rather than a suffix.
            controller.enqueue(encode.encode("I can't help with that one."));
          } else if (!wrote) {
            controller.enqueue(encode.encode("I didn't catch that — try asking again."));
          }
        } catch (e) {
          /**
           * A failure after the first token cannot become a status code: the
           * headers are long gone. The client keeps what it has and the line
           * below says why it stopped, which is more use than a bubble that
           * ends mid-sentence for no visible reason.
           */
          console.error("carzbot stream failed:", e);
          if (wrote) controller.enqueue(encode.encode("\n\n_(cut off — ask again to continue.)_"));
          else controller.error(e);
          return;
        }
        controller.close();
      },
      cancel() {
        // The reader left -- stop paying for tokens nobody will read.
        void stream.abort();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        // Proxies that buffer a response defeat the point of streaming it.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Busy right now — try again in a moment." }, { status: 429 });
    }
    console.error("carzbot failed:", e);
    return NextResponse.json({ error: "CarzBot couldn't answer that." }, { status: 502 });
  }
}
