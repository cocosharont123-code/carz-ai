"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, ImageOff } from "lucide-react";
import { Spinner } from "@/components/ui/editorial";
import { getGarage, type GarageCar } from "@/lib/garage-local";

/**
 * Pick the Home hero from the garage.
 *
 * The garage is read here in the browser because that is the only place it
 * exists — it is localStorage, so no server call could list it. The photo the
 * person picks is what gets saved, rather than an id the server could look up.
 */
export function HeroPicker({
  current,
  onPreview,
  onClose,
  onSaved,
}: {
  current: string;
  /** Shows a photo in the hero behind the sheet without saving it. */
  onPreview: (photo: string | null) => void;
  onClose: () => void;
  onSaved: (photo: string) => void;
}) {
  const [cars, setCars] = useState<GarageCar[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setCars(getGarage().filter((c) => c.image)), 0);
    return () => clearTimeout(t);
  }, []);

  // Escape closes, like the rest of the app's sheets.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function preview(photo: string) {
    setChosen(photo);
    onPreview(photo || null);
  }

  async function save(photo: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError("Couldn't save that. Try again.");
        return;
      }
      onSaved(photo);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const selected = chosen ?? current;

  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-[80] bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a home background"
        className="fixed inset-x-0 bottom-0 z-[85] mx-auto max-h-[72dvh] w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[24px] border-t border-white/12 bg-[#0b0b0b]/95 p-5 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/25" />
        <h2 className="text-[17px] font-bold text-white">Home background</h2>
        <p className="mt-1 text-[13px] text-[#8E8E93]">Tap a photo to preview it behind this sheet.</p>

        {cars === null ? (
          <div className="mt-5 flex justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {/* Default first, so resetting is as reachable as choosing. */}
            <Tile
              label="Default"
              selected={selected === ""}
              onClick={() => preview("")}
            />
            {cars.map((c) => (
              <Tile
                key={c.id}
                photo={c.image}
                label={`${c.make} ${c.model}`}
                selected={selected === c.image}
                onClick={() => preview(c.image)}
              />
            ))}
          </div>
        )}

        {cars !== null && cars.length === 0 && (
          <p className="mt-4 text-[13px] leading-relaxed text-[#8E8E93]">
            Scan a car and it lands in your Garage — then it can go behind this screen.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[12px] text-white">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => save(selected)}
            className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {saving && <Spinner className="h-4 w-4" />}
            Use this photo
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save("")}
            className="press flex h-12 items-center justify-center rounded-full border border-white/20 px-5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
}

function Tile({
  photo,
  label,
  selected,
  onClick,
}: {
  photo?: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`press relative aspect-square overflow-hidden rounded-[14px] border bg-white/[0.06] ${
        selected ? "border-white" : "border-white/12"
      }`}
    >
      {photo ? (
        <Image src={photo} alt={label} fill unoptimized className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <ImageOff className="h-5 w-5 text-white/40" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white">
          <Check className="h-3 w-3 text-black" strokeWidth={3} aria-hidden />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3 text-[10px] text-white">
        {label}
      </span>
    </button>
  );
}
