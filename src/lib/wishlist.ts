// On-device wishlist of auctions/cars the user likes.
// Members get alerts when a wishlisted car is listed or sold (roadmap).

export type WishItem = {
  id: string;
  title: string;
  image: string;
  ts: number;
};

const KEY = "carz_wishlist_v1";

export function getWishlist(): WishItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WishItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: WishItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function isWished(id: string): boolean {
  return getWishlist().some((w) => w.id === id);
}

export function toggleWish(item: WishItem): WishItem[] {
  const items = getWishlist();
  const exists = items.find((w) => w.id === item.id);
  const next = exists ? items.filter((w) => w.id !== item.id) : [{ ...item, ts: Date.now() }, ...items];
  save(next);
  return next;
}

export function removeWish(id: string): WishItem[] {
  const next = getWishlist().filter((w) => w.id !== id);
  save(next);
  return next;
}
