"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Light, Dark, or follow the phone.
 *
 * The choice is kept in localStorage and applied by an inline script in the
 * layout before first paint, so there is no flash of the wrong theme on load.
 * This component only writes the preference and flips the class for the current
 * page; it is not what applies the theme on a cold start.
 *
 * System is the default and is a real option, not a fallback. A phone that
 * switches to dark at sunset should take the app with it unless someone has
 * said otherwise.
 */

type Theme = "light" | "dark" | "system";

const OPTIONS: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Smartphone },
];

/** The one place the class is decided, shared by the picker and the listener. */
function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
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
      const saved = localStorage.getItem("theme");
      setTheme(saved === "light" || saved === "dark" ? saved : "system");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only while following the system. Someone who has picked Light does not want
  // their phone overriding them at sunset.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

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
      className="mt-3 grid grid-cols-3 gap-2"
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
                : "border-[var(--line-card)] bg-[var(--color-surface)] text-foreground",
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
