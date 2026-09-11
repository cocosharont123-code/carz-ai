import { NextResponse } from "next/server";
import { searchProfiles } from "@/lib/profile-blob";

export const runtime = "nodejs";

// Account search. A hashtag query is passed through unchanged — it matches
// nothing in a username today, which is the honest answer until captions are
// indexed, rather than pretending to search something that isn't indexed.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ accounts: [] });

  try {
    return NextResponse.json({ accounts: await searchProfiles(q, 20) });
  } catch {
    return NextResponse.json({ accounts: [], error: "Search is unavailable." }, { status: 502 });
  }
}
