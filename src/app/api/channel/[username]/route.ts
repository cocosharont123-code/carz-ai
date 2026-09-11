import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findByUsername, isActiveMember } from "@/lib/profile-blob";
import { listPostsByAuthor, hashEmail } from "@/lib/feed-blob";
import { followStats } from "@/lib/follows-blob";

export const runtime = "nodejs";

// Everything a channel screen needs, in one request: who they are, their
// counts, whether you follow them, and their videos. Four round trips for one
// screen is what makes a profile feel slow.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw).replace(/^@/, "");

  const session = await auth();
  const email = session?.user?.email ?? null;
  const viewerHash = email ? hashEmail(email) : null;

  const profile = await findByUsername(username);
  const posts = await listPostsByAuthor(username, viewerHash);

  // A channel can exist as a name on posts without a stored profile — the feed
  // records the name it was posted under. Better a channel with their videos
  // and no bio than a 404 on a name the feed itself is showing.
  if (!profile && posts.length === 0) {
    return NextResponse.json({ error: "No such channel." }, { status: 404 });
  }

  const stats = await followStats(username, email ?? undefined);

  return NextResponse.json({
    channel: {
      username: profile?.username ?? username,
      displayName: profile?.displayName ?? username,
      image: profile?.image ?? posts[0]?.authorImage ?? "",
      bio: profile?.bio ?? "",
      cover: profile?.cover ?? "",
      member: profile ? isActiveMember(profile) : false,
      isYou: !!profile && !!email && profile.username === (await meUsername(email)),
    },
    stats: { ...stats, posts: posts.length },
    posts,
  });
}

async function meUsername(email: string): Promise<string | null> {
  const { getProfile } = await import("@/lib/profile-blob");
  return (await getProfile(email))?.username ?? null;
}
