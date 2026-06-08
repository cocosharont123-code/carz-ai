"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function apply(dark: boolean) {
    setIsDark(dark);
    const el = document.documentElement;
    el.classList.toggle("dark", dark);
    el.classList.toggle("light", !dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  // Avoid hydration mismatch — render a placeholder until mounted.
  if (!mounted) return <div className="h-6 w-[68px]" aria-hidden="true" />;

  return (
    <div className="inline-flex items-center gap-1.5">
      <SunIcon className={cn("size-4", isDark && "text-foreground/40")} aria-hidden="true" />
      <Switch checked={isDark} onCheckedChange={apply} aria-label="Toggle dark mode" />
      <MoonIcon className={cn("size-4", !isDark && "text-foreground/40")} aria-hidden="true" />
    </div>
  );
}
