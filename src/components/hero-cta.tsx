"use client";

import { useRouter } from "next/navigation";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

export function HeroCTA() {
  const router = useRouter();
  return (
    <LiquidButton
      size="xl"
      onClick={() => router.push("/spot")}
      className="rounded-full border border-hairline-strong "
    >
      Start spotting
    </LiquidButton>
  );
}
