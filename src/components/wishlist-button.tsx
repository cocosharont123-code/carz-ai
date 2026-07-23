"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isWished, toggleWish, type WishItem } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

// Shared, cached membership check so many hearts don't each hit the API.
let memberCache: boolean | null = null;
let memberPromise: Promise<boolean> | null = null;
function checkMember(): Promise<boolean> {
  if (memberCache !== null) return Promise.resolve(memberCache);
  if (!memberPromise) {
    memberPromise = fetch("/api/membership", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        memberCache = !!d.member;
        return memberCache;
      })
      .catch(() => {
        memberCache = false;
        return false;
      });
  }
  return memberPromise;
}

// Heart toggle — wishlisting is a Carz+ perk. Non-members are sent to /pricing.
export function WishlistButton({ item, className }: { item: WishItem; className?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [member, setMember] = useState<boolean | null>(null);

  useEffect(() => {
    setOn(isWished(item.id));
    checkMember().then(setMember);
  }, [item.id]);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (member === false) {
          router.push("/pricing");
          return;
        }
        toggleWish(item);
        setOn((v) => !v);
      }}
      title={member === false ? "Wishlist is a Carz+ perk" : on ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "press flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/50 text-sm",
        on ? "text-nred" : "text-white/80 hover:text-white",
        className,
      )}
    >
      {on ? "♥" : member === false ? "🔒" : "♡"}
    </button>
  );
}
