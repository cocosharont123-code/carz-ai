"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getHunt, claimCar, matchWanted, totalEarned } from "@/lib/hunt";

const money = (n: number) => "$" + n.toLocaleString("en-US");

type Result = {
  isCar: boolean;
  make: string;
  model: string;
  yearRange: string;
  match: { id: string; name: string; bounty: number } | null;
  alreadyClaimed: boolean;
  awarded: number;
};

export default function HuntSpotPage() {
  const [joined, setJoined] = useState<boolean | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [earned, setEarned] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const h = getHunt();
    setJoined(h.joined);
    setEarned(totalEarned(h));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function startCam() {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch {
      setCamError(
        "Couldn't open the camera. Hunt photos must be taken live in Carz — allow camera access to play.",
      );
    }
  }

  async function capture() {
    const v = videoRef.current;
    if (!v || !streamRef.current) return;
    setBusy(true);
    setResult(null);
    try {
      const max = 1024;
      const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      setShot(dataUrl);

      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, note: "Live car hunt photo." }),
      });
      const d = await res.json();
      const car = d.car || {};
      if (!res.ok || !car.isCar) {
        setResult({ isCar: false, make: car.make || "", model: car.model || "", yearRange: car.yearRange || "", match: null, alreadyClaimed: false, awarded: 0 });
        return;
      }
      const w = matchWanted(car.make, car.model);
      if (w) {
        const before = getHunt();
        const alreadyClaimed = !!before.claimed[w.id];
        let awarded = 0;
        if (!alreadyClaimed) {
          const after = claimCar(w.id);
          awarded = w.bounty;
          setEarned(totalEarned(after));
        }
        setResult({ isCar: true, make: car.make, model: car.model, yearRange: car.yearRange, match: { id: w.id, name: w.name, bounty: w.bounty }, alreadyClaimed, awarded });
      } else {
        setResult({ isCar: true, make: car.make, model: car.model, yearRange: car.yearRange, match: null, alreadyClaimed: false, awarded: 0 });
      }
    } catch {
      setCamError("Something went wrong identifying that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function huntAnother() {
    setResult(null);
    setShot("");
  }

  if (joined === null) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg px-5 py-10">
          <div className="h-80 animate-pulse rounded-3xl bg-foreground/[0.04]" />
        </main>
      </>
    );
  }

  if (!joined) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg px-5 py-16 text-center">
          <div className="text-4xl">🏁</div>
          <h1 className="mt-3 text-2xl font-black">Join the hunt first</h1>
          <p className="mt-1 text-muted-foreground">You need to join Car Hunt Miami before you can earn rewards.</p>
          <Link
            href="/hunt"
            className="mt-5 inline-block rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-500 px-6 py-3 font-black text-white"
          >
            Go join the hunt
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">📸 Hunt camera</h1>
            <p className="text-sm text-muted-foreground">Live photos only — no camera roll.</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Earned</div>
            <div className="text-xl font-black text-emerald-300">{money(earned)}</div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-foreground/[0.08] bg-black">
          <div className="relative aspect-[3/4] w-full">
            {/* Live viewfinder */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${camOn && !result ? "" : "hidden"}`}
            />
            {/* Captured shot (result view) */}
            {result && shot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot} alt="hunt shot" className="h-full w-full object-cover" />
            )}
            {/* Idle / error overlay */}
            {!camOn && !result && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="text-5xl">🎥</div>
                <p className="text-sm text-white/70">
                  {camError || "Turn on the camera to start hunting. You can only use live photos."}
                </p>
                <button
                  onClick={startCam}
                  className="rounded-xl bg-white px-6 py-2.5 font-bold text-[#1f1f1f]"
                >
                  {camError ? "Try again" : "Turn on camera"}
                </button>
              </div>
            )}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                🔎 Identifying…
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4">
            {result ? (
              <ResultCard result={result} onAgain={huntAnother} />
            ) : camOn ? (
              <button
                onClick={capture}
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-500 py-3.5 font-black text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Identifying…" : "📸 Snap & identify"}
              </button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Point at a wanted car and snap it live to claim the bounty.
              </p>
            )}
          </div>
        </div>

        <Link href="/hunt" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
          ← Wanted board
        </Link>
      </main>
    </>
  );
}

function ResultCard({ result, onAgain }: { result: Result; onAgain: () => void }) {
  const car = `${result.make} ${result.model}`.trim();
  let body;
  if (result.match && result.awarded > 0) {
    body = (
      <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/15 p-4 text-center">
        <div className="text-3xl">🎯💰</div>
        <h3 className="mt-1 text-lg font-black text-emerald-300">Bounty claimed!</h3>
        <p className="mt-1 text-sm">
          You found the <span className="font-bold">{result.match.name}</span> — <span className="font-black text-emerald-300">+{money(result.match.bounty)}</span>
        </p>
      </div>
    );
  } else if (result.match) {
    body = (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
        <div className="text-3xl">✅</div>
        <h3 className="mt-1 font-bold">Already claimed</h3>
        <p className="mt-1 text-sm text-muted-foreground">You&apos;ve already banked the {result.match.name} bounty.</p>
      </div>
    );
  } else if (result.isCar) {
    body = (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center">
        <div className="text-3xl">🚗</div>
        <h3 className="mt-1 font-bold">{car || "A car"} — not wanted</h3>
        <p className="mt-1 text-sm text-muted-foreground">That one&apos;s not on the Miami board. Keep hunting!</p>
      </div>
    );
  } else {
    body = (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center">
        <div className="text-3xl">🤔</div>
        <h3 className="mt-1 font-bold">No car detected</h3>
        <p className="mt-1 text-sm text-muted-foreground">Get closer and make sure the car fills the frame.</p>
      </div>
    );
  }
  return (
    <div>
      {body}
      <button
        onClick={onAgain}
        className="mt-3 w-full rounded-xl border border-foreground/15 bg-foreground/[0.06] py-3 font-bold hover:bg-foreground/[0.12]"
      >
        📸 Hunt another
      </button>
    </div>
  );
}
