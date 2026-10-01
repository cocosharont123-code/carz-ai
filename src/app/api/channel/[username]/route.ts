import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findByUsername, isActiveMember } from "@/lib/profile-blob";
import { followStats } from "@/lib/follows-blob";

export const runtime = "nodejs";

// Everything a channel screen needs in one request: who they are, their counts,
// and whether you follow them. It used to return their videos too; with the feed
// gone there are none to return.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw).replace(/^@/, "");

  const session = await auth();
  const email = session?.user?.email ?? null;

  const profile = await findByUsername(username);

  // A stored profile is now the only thing that makes a channel exist. It used
  // to fall back to any name the feed had seen posting, which is how a channel
  // could have videos and no bio; with no posts there is nothing to fall back
  // to and an unknown handle is simply a 404.
  if (!profile) {
    return NextResponse.json({ error: "No such channel." }, { status: 404 });
  }

  const stats = await followStats(username, email ?? undefined);

  return NextResponse.json({
    channel: {
      username: profile.username,
      displayName: profile.displayName ?? username,
      image: profile.image ?? "",
      bio: profile.bio ?? "",
      cover: profile.cover ?? "",
      member: isActiveMember(profile),
      isYou: !!email && profile.username === (await meUsername(email)),
    },
    stats,
  });
}

async function meUsername(email: string): Promise<string | null> {
  const { getProfile } = await import("@/lib/profile-blob");
  return (await getProfile(email))?.username ?? null;
}
