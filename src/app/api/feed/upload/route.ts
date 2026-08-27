import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { blobToken, blobConfigured } from "@/lib/blob-token";

export const runtime = "nodejs";

// Video and custom audio go straight from the browser to Blob storage.
//
// They can't go through a normal route the way photos do: a serverless function
// body caps out around 4.5MB, and base64 in JSON inflates a file by a third on
// top of that. A 20-second clip would fail every time. This endpoint only signs
// the upload — the bytes never touch the function.
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/ogg"];

export async function POST(req: Request): Promise<NextResponse> {
  if (!blobConfigured()) {
    return NextResponse.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      token: blobToken(),
      // Runs before the browser is handed an upload URL. This is the only gate,
      // so the session check has to live here rather than on the write itself.
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        if (!session?.user?.email) {
          throw new Error("Sign in to upload.");
        }
        const isAudio = pathname.startsWith("feed/audio/");
        return {
          allowedContentTypes: isAudio ? AUDIO_TYPES : VIDEO_TYPES,
          maximumSizeInBytes: isAudio ? 10 * 1024 * 1024 : 100 * 1024 * 1024,
          addRandomSuffix: true,
          // Echoed back on completion; not trusted for anything security-related.
          tokenPayload: JSON.stringify({ at: Date.now() }),
        };
      },
      // Fires from Blob's side once the upload lands. Nothing to do: the post
      // isn't created until the composer submits, and an upload the user
      // abandons is cleaned up by whoever prunes the store.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed.";
    // 401 when it's the sign-in gate, so the composer can prompt rather than
    // showing a generic failure.
    const unauth = message === "Sign in to upload.";
    return NextResponse.json({ error: message }, { status: unauth ? 401 : 400 });
  }
}
