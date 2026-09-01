import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // The app opens on Explore — the whole app as one grid of bubbles, so
        // a new arrival can see what Carz does and tap straight into any of
        // it. Redirects are checked before the filesystem, so this wins over
        // app/page.tsx without that file having to be deleted; the landing
        // page is still there if it's ever wanted back.
        source: "/",
        destination: "/explore",
        // 307, not 308: a permanent redirect is cached by browsers forever, so
        // changing where the app opens later would leave everyone who ever
        // visited still being bounced here.
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
