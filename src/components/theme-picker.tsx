"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Light or Dark.
 *
 * The choice is kept in localStorage and applied by an inline script in the
 * layout before first paint, so there is no flash of the wrong theme on load.
 * This component only writes the preference and flips the class for the current
 * page; it is not what applies the theme on a cold start.
 *
 * There is no System option. Anyone who had selected it keeps the stored
 * value, and both this and the boot script read anything that is not "light"
 * as dark -- so an old "system" preference settles on dark rather than needing
 * a migration.
 */

type Theme = "light" | "dark";

const OPTIONS: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
];

/** The one place the class is decided. */
function apply(theme: Theme) {
  const dark = theme !== "light";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

export function ThemePicker() {
  // Null until the stored value is read. Rendering a default first would show
  // the wrong option selected for a frame, and the server has no way to know
  // which one is right.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred a microtask: localStorage is the external system being read, and
    // a synchronous state write in an effect body cascades renders.
    Promise.resolve().then(() => {
      if (cancelled) return;
      // Dark unless Light was explicitly saved -- the same rule the boot
      // script uses, so the selected option always matches what is on screen.
      setTheme(localStorage.getItem("theme") === "light" ? "light" : "dark");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function pick(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing. The theme still applies for this session; it just
      // will not be remembered, which is not worth an error message.
    }
    apply(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="mt-3 grid grid-cols-2 gap-2"
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(id)}
            className={cn(
              "press flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-card border py-3 transition-colors",
              active
                ? "border-foreground bg-carz text-carz-ink"
                : "glass-card",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            <span className="text-[13px] font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
