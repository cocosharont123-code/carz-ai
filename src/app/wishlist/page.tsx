"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PageMasthead, CarPhoto, Button } from "@/components/ui/editorial";
import { getWishlist, removeWish, type WishItem } from "@/lib/wishlist";

export default function WishlistPage() {
  const [items, setItems] = useState<WishItem[] | null>(null);
  const [member, setMember] = useState<boolean | null>(null);

  useEffect(() => {
    setItems(getWishlist());
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMember(!!d.member))
      .catch(() => setMember(false));
  }, []);

  if (member === false) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg px-5 py-16 text-center">
          <div className="rounded-3xl border border-white/12 bg-card text-card-foreground p-10">
            <div className="text-4xl">🔒</div>
            <h1 className="display mt-3 text-3xl">Wishlist is members-only</h1>
            <p className="mx-auto mt-2 max-w-sm text-[13px] opacity-70">
              Save cars you love and get alerted when they&apos;re listed or sold — a Carz+ perk.
            </p>
            <Button href="/pricing" className="mt-6">Get Carz+ · $10/mo</Button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-10">
        <PageMasthead eyebrow="Cars you love" title="Wishlist" count={items ? `${items.length} saved` : "—"} />

        {items === null ? null : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <h3 className="display text-3xl">Nothing saved yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-[13px] opacity-70">
              Tap the ♥ on any auction to save it here. Carz+ members get alerted when a wishlisted car is
              listed or sold.
            </p>
            <Button href="/auctions" className="mt-6">Browse auctions</Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {items.map((w) => (
              <div key={w.id} className="reveal press lift group relative overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground">
                <button
                  onClick={() => setItems(removeWish(w.id))}
                  title="Remove"
                  className="press absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-nred"
                >
                  ♥
                </button>
                <Link href={`/auctions/${w.id}`}>
                  <div className="aspect-square w-full overflow-hidden">
                    <CarPhoto src={w.image} alt={w.title} />
                  </div>
                  <p className="truncate p-3 text-[13px] font-semibold">{w.title}</p>
                </Link>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 util-label text-center opacity-50">Saved on this device.</p>
      </main>
    </>
  );
}
