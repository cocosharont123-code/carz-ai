import { put, list } from "@vercel/blob";
import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID } from "crypto";

// Peer-to-peer car auctions, listed directly by users on Carz.
// Bidders compete; the highest bidder when the timer ends wins and is shown the
// seller's contact info to arrange the sale.
//
// Stored in Vercel Blob. Emails are hashed (identity, never exposed) and the
// seller's contact string is AES-256-GCM encrypted, so nothing sensitive is
// readable from the raw blob — the winner's contact reveal happens server-side.

export type Bid = { bidderName: string; amount: number; ts: number };

export type Auction = {
  id: string;
  sellerHash: string;
  sellerName: string;
  title: string;
  make: string;
  model: string;
  year: string;
  description: string;
  image: string; // base64 thumbnail
  startingBid: number;
  currentBid: number;
  bidCount: number;
  topBidderHash: string;
  topBidderName: string;
  bids: Bid[];
  contactEnc: string; // encrypted seller contact
  createdAt: number;
  endsAt: number;
};

// Public shape returned to clients — no hashes, no encrypted contact.
export type PublicAuction = Omit<Auction, "sellerHash" | "topBidderHash" | "contactEnc"> & {
  ended: boolean;
  youAreSeller: boolean;
  youAreWinner: boolean;
  contact?: string; // only present for seller (always) or winner (after end)
};

const PATH = "auctions.json";

export function auctionsConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

function key(): Buffer {
  return createHash("sha256").update(process.env.AUTH_SECRET || "carz-dev-secret").digest();
}

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(b64: string): string {
  try {
    const buf = Buffer.from(b64, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

export async function readAll(): Promise<Auction[]> {
  const url = await currentUrl();
  if (!url) return [];
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as Auction[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(auctions: Auction[]): Promise<void> {
  await put(PATH, JSON.stringify(auctions), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

// Present an auction for a given viewer (by email hash), revealing contact only
// to the seller (always) or the winner (once the auction has ended).
export function toPublic(a: Auction, viewerHash: string | null): PublicAuction {
  const ended = Date.now() >= a.endsAt;
  const youAreSeller = !!viewerHash && viewerHash === a.sellerHash;
  const youAreWinner = !!viewerHash && ended && a.bidCount > 0 && viewerHash === a.topBidderHash;
  const { sellerHash: _s, topBidderHash: _t, contactEnc, ...rest } = a;
  void _s;
  void _t;
  const out: PublicAuction = { ...rest, ended, youAreSeller, youAreWinner };
  if (youAreSeller || youAreWinner) out.contact = decrypt(contactEnc);
  return out;
}

export async function createAuction(input: {
  sellerEmail: string;
  sellerName: string;
  title: string;
  make: string;
  model: string;
  year: string;
  description: string;
  image: string;
  startingBid: number;
  contact: string;
  durationDays: number;
}): Promise<Auction> {
  const now = Date.now();
  // Allow custom lengths from 1 hour up to 30 days (fractional days = hours).
  const days = Math.max(1 / 24, Math.min(30, input.durationDays || 7));
  const auction: Auction = {
    id: randomUUID().slice(0, 12),
    sellerHash: hashEmail(input.sellerEmail),
    sellerName: input.sellerName || "Seller",
    title: input.title.trim().slice(0, 100),
    make: input.make.trim().slice(0, 40),
    model: input.model.trim().slice(0, 40),
    year: input.year.trim().slice(0, 12),
    description: input.description.trim().slice(0, 1500),
    image: input.image,
    startingBid: Math.max(0, Math.round(input.startingBid)),
    currentBid: Math.max(0, Math.round(input.startingBid)),
    bidCount: 0,
    topBidderHash: "",
    topBidderName: "",
    bids: [],
    contactEnc: encrypt(input.contact.trim().slice(0, 300)),
    createdAt: now,
    endsAt: now + days * 86_400_000,
  };
  const all = await readAll();
  all.unshift(auction);
  await writeAll(all);
  return auction;
}

export async function getAuction(id: string): Promise<Auction | null> {
  const all = await readAll();
  return all.find((a) => a.id === id) ?? null;
}

export async function placeBid(
  id: string,
  bidder: { email: string; name: string },
  amount: number,
): Promise<{ ok: boolean; error?: string; auction?: Auction }> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return { ok: false, error: "Auction not found." };
  const a = all[idx];

  if (Date.now() >= a.endsAt) return { ok: false, error: "This auction has ended." };
  const bidderHash = hashEmail(bidder.email);
  if (bidderHash === a.sellerHash) return { ok: false, error: "You can't bid on your own listing." };

  const amt = Math.round(amount);
  const min = a.bidCount > 0 ? a.currentBid + 1 : a.startingBid;
  if (!(amt >= min)) return { ok: false, error: `Bid must be at least $${min.toLocaleString()}.` };

  a.currentBid = amt;
  a.bidCount += 1;
  a.topBidderHash = bidderHash;
  a.topBidderName = bidder.name || "Bidder";
  a.bids.unshift({ bidderName: bidder.name || "Bidder", amount: amt, ts: Date.now() });
  a.bids = a.bids.slice(0, 50);
  all[idx] = a;
  await writeAll(all);
  return { ok: true, auction: a };
}
