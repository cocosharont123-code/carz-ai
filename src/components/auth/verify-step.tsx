"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Spinner } from "@/components/ui/editorial";

/**
 * Spends the link and sends you on.
 *
 * Runs once. React in development mounts an effect twice, and this one spends a
 * single-use token — without the ref the second run would hand the server a
 * token the first run had already claimed and report a working link as expired.
 */
export function VerifyStep({ token, callbackUrl }: { token: string; callbackUrl: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(!token);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    let alive = true;

    void (async () => {
      const res = await signIn("email-link", { token, redirect: false }).catch(() => null);
      if (!alive) return;
      if (res?.ok && !res.error) {
        router.replace(callbackUrl);
        // Server components above this one cached the signed-out session.
        router.refresh();
      } else {
        setFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, callbackUrl, router]);

  if (failed) {
    return (
      <div role="alert">
        <p className="text-[17px] font-semibold">That link didn&apos;t work</p>
        <p className="mt-1.5 text-[15px] leading-relaxed opacity-65">
          Sign-in links last 15 minutes and work once. If you already used this one, or it has been
          sitting a while, ask for a fresh one.
        </p>
        <Link
          href="/signin"
          className="press mt-5 flex h-12 w-full items-center justify-center rounded-card bg-carz text-[15px] font-semibold text-carz-ink"
        >
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <Spinner className="h-5 w-5" />
      <span className="text-[15px] opacity-70">Checking your link…</span>
    </div>
  );
}
