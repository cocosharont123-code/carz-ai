"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Crosshair, Lock } from "lucide-react";
import { SCAN_MODE_META, type ScanMode } from "@/lib/scan-mode";
import { cn } from "@/lib/utils";

/**
 * How hard the next scan should try, chosen where the scan is about to happen.
 *
 * The setting has always existed — it lives in a cookie that /api/identify
 * reads — but it was only reachable from Settings, which is the one place
 * nobody is standing when they are about to photograph a car. Nothing new is
 * stored and no gate is rebuilt here: this posts to the same endpoint the
 * settings screen does, and that endpoint is what actually enforces that PRO
 * belongs to members.
 *
 * Names and copy come from SCAN_MODE_META so this and the settings screen can
 * never describe the two modes differently.
 */

const MODES: { id: ScanMode; Icon: typeof Zap }[] = [
  { id: "fast", Icon: Zap },
  { id: "precise", Icon: Crosshair },
];

type Settings = { member: boolean; scanMode: ScanMode; effectiveScanMode: ScanMode };

export function ScanModePicker({ onModeChange }: { onModeChange?: (mode: ScanMode) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Settings) => {
        if (cancelled) return;
        setSettings(d);
        onModeChange?.(d.effectiveScanMode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Runs once: this reads the stored preference, and re-running it on a new
    // callback identity would clobber a choice made since.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(mode: ScanMode) {
    if (!settings || saving || settings.scanMode === mode) return;
    setError("");
    setSaving(true);
    // Optimistic: this is a cookie write that either lands or doesn't, and a
    // spinner on a two-button choice costs more than rolling back does.
    const previous = settings;
    setSettings({ ...settings, scanMode: mode, effectiveScanMode: mode });
    onModeChange?.(mode);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanMode: mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSettings(previous);
        onModeChange?.(previous.effectiveScanMode);
        setError(data.error || "Couldn't switch mode.");
      }
    } catch {
      setSettings(previous);
      onModeChange?.(previous.effectiveScanMode);
      setError("Network error — mode not changed.");
    } finally {
      setSaving(false);
    }
  }

  // Reserve the space rather than popping the button down when it arrives.
  if (!settings) {
    return <div className="h-[74px] animate-pulse rounded-2xl bg-white/[0.04]" />;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map(({ id, Icon }) => {
          const meta = SCAN_MODE_META[id];
          const locked = meta.premium && !settings.member;
          // What a scan will really run as, not merely what was chosen — a
          // lapsed membership leaves the old cookie behind, and the picker
          // should agree with the scan rather than with the cookie.
          const selected = settings.effectiveScanMode === id;

          const inner = (
            <>
              <div className="flex items-center gap-2">
                <Icon
                  className={cn("h-4 w-4 shrink-0", !selected && "opacity-60")}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-sm font-bold">{meta.name}</span>
                {locked && <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
              </div>
              <p className={cn("mt-1 text-[11px] leading-snug", selected ? "opacity-70" : "opacity-60")}>
                {meta.tagline}
              </p>
            </>
          );

          // Locked PRO goes to the upsell instead of firing a request that the
          // server would only refuse.
          // Unselected is the app's liquid glass; selected goes solid white
          // with dark text. White reads as chosen at a glance without a glow,
          // and it is the same "this is the active one" language the rest of
          // the app already uses for its primary buttons.
          const cls = cn(
            "press w-full rounded-2xl p-3 text-left transition",
            selected
              ? "bg-white text-neutral-900 shadow-[0_2px_14px_rgba(0,0,0,0.35)]"
              : "glass-card",
            locked && "opacity-70",
          );

          return locked ? (
            <Link key={id} href="/pricing" className={cls} aria-label={`${meta.name} — Carz+ only`}>
              {inner}
            </Link>
          ) : (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              disabled={saving}
              aria-pressed={selected}
              className={cn(cls, "disabled:cursor-not-allowed")}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {!settings.member && (
        <p className="mt-2 text-center text-[11px] opacity-60">
          <Link href="/pricing" className="underline underline-offset-2 hover:opacity-80">
            Get Carz+
          </Link>{" "}
          to unlock {SCAN_MODE_META.precise.name} scanning.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-center text-[11px] text-neon-red">
          {error}
        </p>
      )}
    </div>
  );
}
