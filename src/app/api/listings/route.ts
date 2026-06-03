import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Real car listings via eBay's Finding API (App-ID only, no OAuth).
// Get a free App ID at https://developer.ebay.com and set EBAY_APP_ID in .env.local.
// Without it, the route reports unconfigured and the UI falls back to search links.

type Listing = {
  title: string;
  price: number;
  currency: string;
  image: string;
  url: string;
  location: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const make = (searchParams.get("make") || "").trim();
  const model = (searchParams.get("model") || "").trim();
  const keywords = `${make} ${model}`.trim();

  if (!keywords) {
    return NextResponse.json({ configured: true, items: [] });
  }

  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    return NextResponse.json({ configured: false, items: [] });
  }

  const params = new URLSearchParams({
    "OPERATION-NAME": "findItemsByKeywords",
    "SERVICE-VERSION": "1.0.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    keywords,
    categoryId: "6001", // eBay Motors > Cars & Trucks
    "paginationInput.entriesPerPage": "8",
    sortOrder: "PricePlusShippingLowest",
    "outputSelector(0)": "PictureURLLarge",
    "outputSelector(1)": "SellerInfo",
  });

  try {
    const res = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`, {
      headers: { Accept: "application/json" },
      // listings refresh often; cache briefly
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({ configured: true, items: [], error: `eBay ${res.status}` });
    }
    const data = await res.json();
    const raw =
      data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item ?? [];

    const items: Listing[] = raw.map((it: Record<string, unknown[]>) => {
      const selling = (it.sellingStatus?.[0] ?? {}) as Record<string, unknown[]>;
      const cur = (selling.currentPrice?.[0] ?? {}) as Record<string, string>;
      return {
        title: String(it.title?.[0] ?? ""),
        price: parseFloat(cur.__value__ ?? "0") || 0,
        currency: cur["@currencyId"] ?? "USD",
        image: String((it.pictureURLLarge?.[0] as string) ?? (it.galleryURL?.[0] as string) ?? ""),
        url: String(it.viewItemURL?.[0] ?? ""),
        location: String(it.location?.[0] ?? ""),
      };
    });

    return NextResponse.json({ configured: true, items });
  } catch {
    return NextResponse.json({ configured: true, items: [], error: "fetch_failed" });
  }
}
