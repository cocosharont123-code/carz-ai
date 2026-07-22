"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getHunt, claimCar, matchWanted, colorOk, totalEarned } from "@/lib/hunt";

const money = (n: number) => "$" + n.toLocaleString("en-US");

type Result = {
  isCar: boolean;
  make: string;
  model: string;
  yearRange: string;
  color: string;
  match: { id: string; name: string; bounty: number } | null;
  colorLabel: string;
  colorOk: boolean;
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
      const base = {
        isCar: !!car.isCar,
        make: car.make || "",
        model: car.model || "",
        yearRange: car.yearRange || "",
        color: car.color || "",
      };
      if (!res.ok || !car.isCar) {
        setResult({ ...base, isCar: false, match: null, colorLabel: "", colorOk: false, alreadyClaimed: false, awarded: 0 });
        return;
      }
      const w = matchWanted(car.make, car.model);
      if (!w) {
        setResult({ ...base, match: null, colorLabel: "", colorOk: false, alreadyClaimed: false, awarded: 0 });
        return;
      }
      const colorMatches = colorOk(w, car.color);
      if (!colorMatches) {
        // Right car, wrong color — no bounty.
        setResult({ ...base, match: { id: w.id, name: w.name, bounty: w.bounty }, colorLabel: w.colorLabel, colorOk: false, alreadyClaimed: false, awarded: 0 });
        return;
      }
      const before = getHunt();
      const alreadyClaimed = !!before.claimed[w.id];
      let awarded = 0;
      if (!alreadyClaimed) {
        const after = claimCar(w.id);
        awarded = w.bounty;
        setEarned(totalEarned(after));
      }
      setResult({ ...base, match: { id: w.id, name: w.name, bounty: w.bounty }, colorLabel: w.colorLabel, colorOk: true, alreadyClaimed, awarded });
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
          <p className="mt-1 text-ngreen">You need to join Car Hunt Miami before you can earn rewards.</p>
          <Link
            href="/hunt"
            className="mt-5 inline-block rounded-xl bg-gradient-to-br from-neon-red to-neon-red px-6 py-3 font-black text-nblue"
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
            <p className="text-sm text-ngreen">Live photos only — no camera roll.</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-ngreen">Earned</div>
            <div className="text-xl font-black text-neon-green">{money(earned)}</div>
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
                <p className="text-sm text-nred">
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-nblue">
                🔎 Identifying…
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4">
            {result ? (
              <ResultCard result={result} shot={shot} onAgain={huntAnother} />
            ) : camOn ? (
              <button
                onClick={capture}
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-br from-neon-red to-neon-red py-3.5 font-black text-nblue transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Identifying…" : "📸 Snap & identify"}
              </button>
            ) : (
              <p className="text-center text-xs text-ngreen">
                Point at a wanted car and snap it live to claim the bounty.
              </p>
            )}
          </div>
        </div>

        <Link href="/hunt" className="mt-4 block text-center text-sm text-ngreen hover:text-nblue">
          ← Wanted board
        </Link>
      </main>
    </>
  );
}

function ResultCard({ result, shot, onAgain }: { result: Result; shot: string; onAgain: () => void }) {
  const car = `${result.make} ${result.model}`.trim();
  let body;
  if (result.match && result.colorOk) {
    body = (
      <div className="rounded-2xl border border-neon-green/50 bg-neon-green/15 p-4 text-center">
        <div className="text-3xl">🎯💰</div>
        <h3 className="mt-1 text-lg font-black text-neon-green">
          {result.awarded > 0 ? "Bounty found!" : "You spotted a wanted car!"}
        </h3>
        <p className="mt-1 text-sm">
          <span className="font-bold">{result.match.name}</span> — <span className="font-black text-neon-green">{money(result.match.bounty)}</span>
        </p>
        <p className="mt-1 text-xs text-ngreen">📍 Must be on a public road — verified from your photo.</p>
        <ClaimPrize carId={result.match.id} bounty={result.match.bounty} shot={shot} />
      </div>
    );
  } else if (result.match && !result.colorOk) {
    body = (
      <div className="rounded-2xl border border-neon-red/40 bg-neon-red/10 p-4 text-center">
        <div className="text-3xl">🎨❌</div>
        <h3 className="mt-1 font-black text-neon-red">Wrong color!</h3>
        <p className="mt-1 text-sm">
          That&apos;s a <span className="font-bold">{result.match.name}</span>, but only the{" "}
          <span className="font-bold">{result.colorLabel.replace(/\s*only$/i, "")}</span> one counts
          {result.color ? ` — yours looks ${result.color.toLowerCase()}.` : "."}
        </p>
      </div>
    );
  } else if (result.isCar) {
    body = (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center">
        <div className="text-3xl">🚗</div>
        <h3 className="mt-1 font-bold">{car || "A car"} — not wanted</h3>
        <p className="mt-1 text-sm text-ngreen">That one&apos;s not on the Miami board. Keep hunting!</p>
      </div>
    );
  } else {
    body = (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center">
        <div className="text-3xl">🤔</div>
        <h3 className="mt-1 font-bold">No car detected</h3>
        <p className="mt-1 text-sm text-ngreen">Get closer and make sure the car fills the frame.</p>
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

function ClaimPrize({ carId, bounty, shot }: { carId: string; bounty: number; shot: string }) {
  const [open, setOpen] = useState(false);
  const [cashapp, setCashapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!cashapp.trim()) {
      setError("Enter your CashApp name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/hunt/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, cashapp, image: shot }),
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.error || "Couldn't submit your claim.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-4 rounded-xl border border-neon-green/40 bg-background/50 p-3 text-left text-sm">
        ✅ <span className="font-bold">Claim submitted!</span> Verification takes up to{" "}
        <span className="font-bold">48 hours</span>. Once your spot is verified, {money(bounty)} will be
        sent to <span className="font-bold">{cashapp}</span> on CashApp.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-xl bg-white py-2.5 font-black text-[#1f1f1f] transition hover:opacity-90"
      >
        💵 Claim prize
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-foreground/15 bg-background/50 p-3 text-left">
      <p className="text-xs text-ngreen">
        Verification takes <span className="font-semibold text-nblue">up to 48 hours</span>. Once
        verified, your {money(bounty)} prize is sent through <span className="font-semibold text-nblue">CashApp</span>.
        Enter your CashApp name so we can send the money.
      </p>
      <input
        value={cashapp}
        onChange={(e) => setCashapp(e.target.value)}
        placeholder="$YourCashtag"
        maxLength={60}
        className="mt-2 w-full rounded-lg border border-foreground/15 bg-foreground/[0.04] px-3 py-2.5 text-sm outline-none focus:border-foreground/30"
      />
      {error && <p className="mt-1.5 text-xs text-neon-red">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="mt-2 w-full rounded-lg bg-gradient-to-br from-neon-green to-neon-blue py-2.5 text-sm font-bold text-nblue transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit claim"}
      </button>
    </div>
  );
}
