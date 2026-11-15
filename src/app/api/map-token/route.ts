import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readMapboxToken } from "@/lib/map-config-blob";

export const runtime = "nodejs";

/**
 * The token the map draws with.
 *
 * Signed-in only. Not because the token is a secret -- it is a public `pk.`
 * token and it ends up in the browser either way -- but because every route in
 * this app asks auth() who it is talking to, and an endpoint that hands out
 * configuration to anybody who asks is a thing to point a script at.
 *
 * `no-store`: the client caches it for the life of the page and the server
 * caches it per warm instance. A CDN copy in between would be the layer that
 * makes a rotated token take an hour to take effect.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ token: "" }, { status: 401 });
  }
  const token = await readMapboxToken();
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
