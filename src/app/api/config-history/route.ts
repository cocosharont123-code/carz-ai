import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProfile, isActiveMember, profilesConfigured } from "@/lib/profile-blob";
import {
  getConfigHistory,
  deleteConfig,
  clearConfigHistory,
  configHistoryConfigured,
} from "@/lib/config-history";

export const runtime = "nodejs";

/**
 * The signed-in member's saved car-configuration history. Carz+ only — the
 * same gate the Builds page applies in the UI, enforced here too so the data
 * isn't readable by simply calling the endpoint.
 */

type Gate = { email: string } | { error: NextResponse };

async function requireMember(): Promise<Gate> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { error: NextResponse.json({ ok: false, error: "Sign in first.", needSignIn: true }, { status: 401 }) };
  }
  // With profile storage down we can't prove membership, so deny rather than
  // hand out a members-only history.
  const member = profilesConfigured() && isActiveMember(await getProfile(email));
  if (!member) {
    return { error: NextResponse.json({ ok: false, error: "Carz+ members only.", needMember: true }, { status: 403 }) };
  }
  return { email };
}

export async function GET() {
  const gate = await requireMember();
  if ("error" in gate) return gate.error;

  if (!configHistoryConfigured()) {
    // Not an error state for the UI — there's simply nothing stored yet.
    return NextResponse.json({ ok: true, entries: [], configured: false });
  }

  try {
    const entries = await getConfigHistory(gate.email);
    return NextResponse.json({ ok: true, entries, configured: true });
  } catch (e) {
    console.error("config history read failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn't load your config history." }, { status: 500 });
  }
}

// DELETE ?id=… removes one entry; with no id it clears the whole history.
export async function DELETE(req: Request) {
  const gate = await requireMember();
  if ("error" in gate) return gate.error;

  const id = new URL(req.url).searchParams.get("id");
  try {
    if (id) {
      const entries = await deleteConfig(gate.email, id);
      return NextResponse.json({ ok: true, entries });
    }
    await clearConfigHistory(gate.email);
    return NextResponse.json({ ok: true, entries: [] });
  } catch (e) {
    console.error("config history delete failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn't update your config history." }, { status: 500 });
  }
}
