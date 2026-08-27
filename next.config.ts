import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // The app opens on the spotter rather than a marketing homepage.
        // Redirects are checked before the filesystem, so this wins over
        // app/page.tsx without that file having to be deleted — the landing
        // page is still there if it's ever wanted back.
        source: "/",
        destination: "/spot",
        // 307, not 308: a permanent redirect is cached by browsers forever,
        // so restoring a homepage later would leave everyone who ever visited
        // still being bounced to /spot.
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
