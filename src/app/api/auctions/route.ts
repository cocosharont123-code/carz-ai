import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Live car auctions surfaced through Carz, powered by a 3rd-party source (eBay Motors).
// Uses eBay's Finding API (App-ID only, no OAuth) filtered to auction-format listings.
// Get a free App ID at https://developer.ebay.com and set EBAY_APP_ID to go live.
// Without it we return a clearly-labelled preview so the section still works.

export type Auction = {
  id: string;
  title: string;
  currentBid: number;
  currency: string;
  bids: number;
  endsAt: number; // epoch ms
  image: string;
  url: string;
  location: string;
};

// Shown when no eBay App ID is configured. Marked as a preview in the UI.
function sampleAuctions(): Auction[] {
  const now = Date.now();
  const h = 3600_000;
  const data: Omit<Auction, "endsAt" | "id">[] = [
    { title: "1994 Toyota Supra MK4 Twin-Turbo (6-speed)", currentBid: 78250, currency: "USD", bids: 41, image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=70", url: "https://www.ebay.com/sch/i.html?_nkw=toyota+supra&LH_Auction=1", location: "Los Angeles, CA" },
    { title: "1989 Porsche 911 Carrera Targa", currentBid: 41100, currency: "USD", bids: 27, image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=70", url: "https://www.ebay.com/sch/i.html?_nkw=porsche+911&LH_Auction=1", location: "Miami, FL" },
    { title: "1967 Ford Mustang Fastback — Restored", currentBid: 54900, currency: "USD", bids: 33, image: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?w=800&q=70", url: "https://www.ebay.com/sch/i.html?_nkw=ford+mustang+fastback&LH_Auction=1", location: "Austin, TX" },
    { title: "2002 Nissan Skyline GT-R R34 (legal import)", currentBid: 132000, currency: "USD", bids: 58, image: "https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?w=800&q=70", url: "https://www.ebay.com/sch/i.html?_nkw=nissan+skyline+r34&LH_Auction=1", location: "Seattle, WA" },
    { title: "1972 Chevrolet C10 Shortbed Pickup", currentBid: 28750, currency: "USD", bids: 19, image: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=70", url: "https://www.ebay.com/sch/i.html?_nkw=chevrolet+c10&LH_Auction=1", location: "Phoenix, AZ" },
    { title: "1985 BMW M635CSi (E24) Sharknose", currentBid: 36400, currency: "USD", bids: 22, image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=70", url: "https://www.ebay.com/sch/i.html?_nkw=bmw+e24&LH_Auction=1", location: "Denver, CO" },
  ];
  return data.map((d, i) => ({ ...d, id: `sample-${i}`, endsAt: now + (i + 1) * 7 * h + i * 1100_000 }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const make = (searchParams.get("make") || "").trim();
  const model = (searchParams.get("model") || "").trim();
  const q = (searchParams.get("q") || `${make} ${model}`).trim();

  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    let items = sampleAuctions();
    if (q) {
      const needle = q.toLowerCase();
      const filtered = items.filter((a) => a.title.toLowerCase().includes(needle));
      if (filtered.length) items = filtered;
    }
    return NextResponse.json({ configured: false, source: "eBay Motors", items });
  }

  const params = new URLSearchParams({
    "OPERATION-NAME": "findItemsAdvanced",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    categoryId: "6001", // eBay Motors > Cars & Trucks
    sortOrder: "EndTimeSoonest",
    "paginationInput.entriesPerPage": "24",
    "itemFilter(0).name": "ListingType",
    "itemFilter(0).value(0)": "Auction",
    "itemFilter(0).value(1)": "AuctionWithBIN",
    "outputSelector(0)": "PictureURLLarge",
  });
  if (q) params.set("keywords", q);

  try {
    const res = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return NextResponse.json({ configured: true, source: "eBay Motors", items: [], error: `eBay ${res.status}` });
    }
    const data = await res.json();
    const raw = data?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item ?? [];

    const items: Auction[] = raw.map((it: Record<string, unknown[]>) => {
      const selling = (it.sellingStatus?.[0] ?? {}) as Record<string, unknown[]>;
      const listing = (it.listingInfo?.[0] ?? {}) as Record<string, unknown[]>;
      const cur = (selling.currentPrice?.[0] ?? {}) as Record<string, string>;
      const end = String(listing.endTime?.[0] ?? "");
      return {
        id: String(it.itemId?.[0] ?? Math.random()),
        title: String(it.title?.[0] ?? ""),
        currentBid: parseFloat(cur.__value__ ?? "0") || 0,
        currency: cur["@currencyId"] ?? "USD",
        bids: parseInt(String(selling.bidCount?.[0] ?? "0"), 10) || 0,
        endsAt: end ? new Date(end).getTime() : Date.now(),
        image: String((it.pictureURLLarge?.[0] as string) ?? (it.galleryURL?.[0] as string) ?? ""),
        url: String(it.viewItemURL?.[0] ?? ""),
        location: String(it.location?.[0] ?? ""),
      };
    });

    return NextResponse.json({ configured: true, source: "eBay Motors", items });
  } catch {
    return NextResponse.json({ configured: true, source: "eBay Motors", items: [], error: "fetch_failed" });
  }
}
