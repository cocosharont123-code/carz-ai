"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Signed-in users must have a username. If they don't, send them to /profile.
export function ProfileGate() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    // Don't redirect away from the pages needed to complete setup.
    if (pathname === "/profile" || pathname === "/signin") return;
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        // Only bounce a signed-in user who has no username yet.
        if (d.signedIn && d.configured !== false && !d.pending && !d.profile?.username) {
          router.replace(`/profile?next=${encodeURIComponent(pathname || "/spot")}`);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, pathname, router]);

  return null;
}
