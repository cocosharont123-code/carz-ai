"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULTS, applyPrefs, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";

type Ctx = {
  prefs: Prefs;
  /** Patch one or more preferences; persists and applies immediately. */
  set: (patch: Partial<Prefs>) => void;
  reset: () => void;
  /** False until the stored values have been read, so the UI can hold still. */
  ready: boolean;
};

const PrefsContext = createContext<Ctx>({
  prefs: DEFAULTS,
  set: () => {},
  reset: () => {},
  ready: false,
});

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Starts at DEFAULTS to match what the server rendered; the stored values land
  // on mount. The visible theme does not wait for this — the boot script in the
  // layout has already painted it.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      setPrefs(loadPrefs());
      setReady(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // Follow the OS while the theme is "system" — a laptop flipping to dark at
  // sunset should take the app with it, without a reload.
  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyPrefs(prefs);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs]);

  const set = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      applyPrefs(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    savePrefs(DEFAULTS);
    applyPrefs(DEFAULTS);
    setPrefs(DEFAULTS);
  }, []);

  return <PrefsContext.Provider value={{ prefs, set, reset, ready }}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Ctx {
  return useContext(PrefsContext);
}
