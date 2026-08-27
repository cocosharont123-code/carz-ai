import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  deleteProfile,
  profilesConfigured,
  ProfileStorageError,
  UNAME_COOKIE,
} from "@/lib/profile-blob";
import { getUserId, deleteUser, UID_COOKIE, PLAN_COOKIE } from "@/lib/store";
import { SCAN_MODE_COOKIE } from "@/lib/scan-mode";

export const runtime = "nodejs";

// Every cookie that identifies this spotter. Cleared together so deletion
// doesn't leave a signed-out browser still pointing at a freed record.
const IDENTITY_COOKIES = [UID_COOKIE, PLAN_COOKIE, UNAME_COOKIE, SCAN_MODE_COOKIE];

/**
 * DELETE -> erase the account.
 *
 * Destroys the stored profile (username, picture, membership, streak) and this
 * device's local record (scan counts, spotting history), then clears the
 * identity cookies. The client signs out afterwards.
 *
 * Requires `{ confirm: "DELETE" }` in the body. The UI already asks twice; this
 * is the backstop that stops a bare DELETE to a guessable URL from wiping an
 * account, since a session cookie alone would otherwise be enough.
 */
export async function DELETE(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { ok: false, error: "Deletion must be confirmed." },
      { status: 400 },
    );
  }

  // Local record first: it can't fail in a way worth aborting over, and doing it
  // before the blob write means a storage outage leaves the account intact
  // rather than half-erased.
  const { id } = await getUserId();
  deleteUser(id);

  let profileRemoved = false;
  if (profilesConfigured()) {
    try {
      profileRemoved = await deleteProfile(email);
    } catch (e) {
      // The profile is the durable half of the account. If it survived, say so
      // instead of reporting a deletion that didn't happen — the spotter would
      // sign back in later and find themselves still there.
      console.error("account deletion failed:", e);
      const down = e instanceof ProfileStorageError;
      const detail = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          ok: false,
          unavailable: down,
          error: down
            ? `Your account couldn't be deleted — profile storage is unavailable: ${detail}`
            : `Your account couldn't be deleted: ${detail}`,
        },
        { status: down ? 503 : 500 },
      );
    }
  }

  const jar = await cookies();
  for (const name of IDENTITY_COOKIES) {
    jar.set(name, "", { path: "/", maxAge: 0 });
  }

  return NextResponse.json({ ok: true, profileRemoved });
}
