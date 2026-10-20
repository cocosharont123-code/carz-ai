"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchPill } from "@/components/ui/editorial";

/**
 * The hero's search field.
 *
 * A client island rather than a client page: everything else on Home is
 * server-rendered so the hero photo is right on the first paint, and this is
 * the only part that needs a router.
 *
 * Submits to /search, which is the app's existing search -- it matches
 * accounts and features, and is where a typed query already goes from
 * elsewhere in the app.
 */
export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <SearchPill
      value={q}
      onChange={setQ}
      onSubmit={() => {
        const term = q.trim();
        if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
      }}
      placeholder="Search any car..."
      label="Search any car"
    />
  );
}
