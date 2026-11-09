import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { profilesConfigured, setHomeHero } from "@/lib/profile-blob";
import { isSafeImageDataUrl } from "@/lib/safe-media";

export const runtime = "nodejs";

/**
 * Set or clear the photo behind the Home hero.
 *
 * On what this can and cannot check. The brief asked the server to accept only
 * a photo that belongs to the caller's garage — and it cannot, because the
 * garage is localStorage. It is written by the browser, never sent anywhere,
 * and the server has no record of a single entry in it; there is no list here
 * to check membership against.
 *
 * What is actually enforced is the part that matters: the session decides whose
 * profile is written, so nobody can set anyone else's hero, and the payload has
 * to be a raster data: URL under the cap — no SVG, which is a document that can
 * carry script. The remaining gap is that someone could set their own hero to a
 * photo that was never in their own garage, which costs them a different
 * picture on their own home screen.
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  if (!profilesConfigured()) {
    return NextResponse.json({ ok: false, error: "Profiles are not configured." }, { status: 503 });
  }

  let body: { photo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // "" is an explicit reset to the default.
  const photo = body.photo === "" ? "" : body.photo;
  if (photo !== "" && !isSafeImageDataUrl(photo, 400_000)) {
    return NextResponse.json({ ok: false, error: "bad_photo" }, { status: 400 });
  }

  const ok = await setHomeHero(email, photo as string);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
}
