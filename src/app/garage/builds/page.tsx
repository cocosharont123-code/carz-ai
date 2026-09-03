"use client";

import { useEffect, useState } from "react";
import { Palette, X } from "lucide-react";
import { PageTabs } from "@/components/page-tabs";
import { MemberGate } from "@/components/member-gate";
import { getBuilds, removeBuild, clearBuilds, type SavedBuild } from "@/lib/builds-local";
import type { ConfigEntry } from "@/lib/config-history";
import { Button, PageMasthead, StatRow, CarPhoto, Skeleton, Spinner } from "@/components/ui/editorial";

/**
 * A member's car-configuration history. The configs come from the account
 * (server-side, so the list is the same on every device); the render thumbnails
 * are whatever this particular browser still has cached. An entry with no local
 * render shows a placeholder rather than being hidden — the config is the
 * record, the picture is a bonus.
 */
type Build = ConfigEntry & { image?: string; local?: boolean };

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BuildsPage() {
  return (
    <MemberGate
      tabs={<PageTabs group="collection" />}
      title="Builds"
      blurb="Every car configuration you've generated, saved to your account."
      points={[
        "Logs the body colour, rims and mods behind every render you generate.",
        "Saved to your Carz+ account, so the list follows you across devices.",
        "Keeps the render itself on whichever device made it.",
      ]}
    >
      <BuildsInner />
    </MemberGate>
  );
}

function BuildsInner() {
  const [loading, setLoading] = useState(true);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let live = true;

    // Local renders first — they're synchronous and make the grid appear
    // instantly — then reconcile against the account's history.
    const local = getBuilds();

    (async () => {
      try {
        const res = await fetch("/api/config-history", { cache: "no-store" });
        const d = await res.json().catch(() => null);
        if (!live) return;
        if (!res.ok || !d?.ok) {
          // Fall back to whatever this device has, so a storage outage still
          // shows something rather than an empty garage.
          setBuilds(local.map(toBuild));
          setError(d?.error || "Couldn't reach your account history — showing this device only.");
          return;
        }
        setBuilds(merge(d.entries as ConfigEntry[], local));
      } catch {
        if (!live) return;
        setBuilds(local.map(toBuild));
        setError("Couldn't reach your account history — showing this device only.");
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  async function remove(id: string) {
    setPendingId(id);
    try {
      await fetch(`/api/config-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* drop it locally regardless — a stale server row resurfaces on reload */
    } finally {
      removeBuild(id);
      setBuilds((b) => b.filter((x) => x.id !== id));
      setPendingId(null);
    }
  }

  async function clearAll() {
    if (!window.confirm("Delete your entire configuration history? This can't be undone.")) return;
    setClearing(true);
    try {
      await fetch("/api/config-history", { method: "DELETE" });
    } catch {
      /* same as above */
    } finally {
      clearBuilds();
      setBuilds([]);
      setClearing(false);
    }
  }

  const uniqueCars = new Set(builds.map((b) => `${b.make} ${b.model}`.trim())).size;
  const modCount = builds.reduce((n, b) => n + b.features.length, 0);

  return (
    <>
      <PageTabs group="collection" />
      <main className="mx-auto w-full max-w-4xl px-5 py-10">
        <PageMasthead
          eyebrow="Your configs · Carz+"
          title="Builds"
          count={loading ? "—" : `${builds.length} saved`}
          action={
            builds.length > 0 ? (
              <button onClick={clearAll} disabled={clearing} className="util-label flex items-center gap-2">
                {clearing && <Spinner className="h-3 w-3" />}
                Clear all
              </button>
            ) : null
          }
        />

        {error && !loading && (
          <p className="mt-4 rounded-xl border border-carz/40 bg-carz/10 p-3 text-sm">{error}</p>
        )}

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground">
                <Skeleton className="aspect-square w-full" />
              </div>
            ))}
          </div>
        ) : builds.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <h3 className="display text-3xl">No builds yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm ">
              Spot a car and customize the look — every config you generate is saved here automatically.
            </p>
            <Button href="/spot" className="mt-6">Customize a car</Button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <StatRow value={builds.length} label="Configs" className="p-4 sm:p-6" />
              <StatRow value={uniqueCars} label="Unique cars" yellow className="p-4 sm:p-6" />
              <StatRow value={modCount} label="Mods applied" className="p-4 sm:p-6" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {builds.map((b) => (
                <div key={b.id} className="reveal press lift group relative overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground">
                  <button
                    onClick={() => remove(b.id)}
                    disabled={pendingId === b.id}
                    title="Delete config"
                    className="absolute rounded-lg right-2 top-2 z-10 hidden h-6 w-6 items-center justify-center bg-black/70 text-white text-xs  group-hover:flex hover:bg-carz "
                  >
                    {pendingId === b.id ? <Spinner className="h-3 w-3" /> : <X className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                  <div className="relative aspect-square w-full overflow-hidden">
                    {/* Renders show in full colour — the colour is the whole point. */}
                    <CarPhoto
                      src={b.image}
                      alt={`Customized ${b.make} ${b.model}`}
                      color
                      fallback={<Palette className="h-9 w-9 opacity-40" strokeWidth={1.5} aria-hidden />}
                      className="h-full w-full"
                    />
                    {!b.image && (
                      <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        Rendered on another device
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold ">{b.make} {b.model}</p>
                    <p className="util-label mt-1 truncate ">{b.yearRange}</p>

                    {(b.bodyColor || b.rimColor) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {b.bodyColor && (
                          <span className="flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px]">
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-black/20"
                              style={{ background: b.bodyHex }}
                            />
                            {b.bodyColor}
                          </span>
                        )}
                        {b.rimColor && (
                          <span className="flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px]">
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-black/20"
                              style={{ background: b.rimHex }}
                            />
                            {b.rimColor}
                          </span>
                        )}
                      </div>
                    )}

                    {b.features.length > 0 && (
                      <p className="mt-1.5 text-[11px] opacity-70">{b.features.join(" · ")}</p>
                    )}

                    <p className="mt-1 text-[11px] ">{fmtDate(b.ts)}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 util-label text-center ">
              Configs sync with your Carz+ account · renders stay on the device that made them.
            </p>
          </>
        )}
      </main>
    </>
  );
}

/** A device-only build, for when the account history can't be read. */
function toBuild(b: SavedBuild): Build {
  return { ...b, local: true };
}

/**
 * Account history is the source of truth for which configs exist; the local
 * cache only supplies pictures. Local-only builds (generated before the history
 * existed, or while storage was down) are kept and sorted in by date so nothing
 * a member already had silently disappears.
 */
function merge(entries: ConfigEntry[], local: SavedBuild[]): Build[] {
  const images = new Map(local.map((b) => [b.id, b.image]));
  const synced: Build[] = entries.map((e) => ({ ...e, image: images.get(e.id) }));

  const seen = new Set(entries.map((e) => e.id));
  const orphans = local.filter((b) => !seen.has(b.id)).map(toBuild);

  return [...synced, ...orphans].sort((a, b) => b.ts - a.ts);
}
