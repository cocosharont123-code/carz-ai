import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProfile, isActiveMember } from "@/lib/profile-blob";
import { huntStatus, enterHunt, HuntEntriesError } from "@/lib/hunt-entries";

export const runtime = "nodejs";

// GET -> how many have entered, whether it has started, whether you are in.
export async function GET() {
  const session = await auth();
  try {
    return NextResponse.json(await huntStatus(session?.user?.email ?? undefined));
  } catch (e) {
    const message = e instanceof HuntEntriesError ? e.message : "Couldn't read the hunt.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// POST -> enter. Members only, matching the gate on the page itself: the count
// is what decides whether the hunt starts, so it has to mean the same thing the
// board says it means.
export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in to enter the hunt." }, { status: 401 });
  }
  if (!isActiveMember(await getProfile(email))) {
    return NextResponse.json({ error: "The hunt is a Carz+ feature." }, { status: 402 });
  }
  try {
    return NextResponse.json(await enterHunt(email));
  } catch (e) {
    const message = e instanceof HuntEntriesError ? e.message : "Couldn't enter the hunt.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
