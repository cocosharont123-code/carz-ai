import { put, list } from "@vercel/blob";
import { randomUUID } from "crypto";
import { WANTED } from "./hunt";

// Prize claims for Car Hunt Miami, stored in Vercel Blob so the owner can
// review them (photo evidence + CashApp tag) and pay out the bounty.

export type Claim = {
  id: string;
  carId: string;
  carName: string;
  bounty: number;
  cashapp: string;
  image: string; // small photo of the spotted car (evidence)
  spotter: string; // @username or "Guest"
  ts: number;
  status: "pending" | "paid";
};

const PATH = "hunt-claims.json";

export function claimsConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// The account that receives claims and pays out. Override with HUNT_OWNER_EMAIL.
export function ownerEmail(): string {
  return (process.env.HUNT_OWNER_EMAIL || "cocosharont123@gmail.com").toLowerCase().trim();
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

export async function readClaims(): Promise<Claim[]> {
  const url = await currentUrl();
  if (!url) return [];
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as Claim[]) : [];
  } catch {
    return [];
  }
}

async function writeClaims(claims: Claim[]): Promise<void> {
  await put(PATH, JSON.stringify(claims), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

export async function addClaim(input: {
  carId: string;
  cashapp: string;
  image: string;
  spotter: string;
}): Promise<{ ok: boolean; error?: string; claim?: Claim }> {
  const car = WANTED.find((w) => w.id === input.carId);
  if (!car) return { ok: false, error: "Unknown car." };
  const cashapp = input.cashapp.trim().slice(0, 60);
  if (!cashapp) return { ok: false, error: "Enter your CashApp name." };

  const claim: Claim = {
    id: randomUUID().slice(0, 10),
    carId: car.id,
    carName: car.name,
    bounty: car.bounty,
    cashapp,
    image: typeof input.image === "string" && input.image.startsWith("data:") ? input.image.slice(0, 80_000) : "",
    spotter: input.spotter || "Guest",
    ts: Date.now(),
    status: "pending",
  };
  const all = await readClaims();
  all.unshift(claim);
  await writeClaims(all.slice(0, 500));
  return { ok: true, claim };
}
