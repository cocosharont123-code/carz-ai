"use client";

import { useEffect, useState } from "react";
import { isWished, toggleWish, type WishItem } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

// Heart toggle for wishlisting an auction/car. Stops link navigation.
export function WishlistButton({ item, className }: { item: WishItem; className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isWished(item.id));
  }, [item.id]);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWish(item);
        setOn((v) => !v);
      }}
      title={on ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "press flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/50 text-sm",
        on ? "text-nred" : "text-white/80 hover:text-white",
        className,
      )}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}
