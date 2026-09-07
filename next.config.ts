import type { NextConfig } from "next";

// No redirect on "/". It is the launch homepage now — the countdown to the App
// Store release — and app/page.tsx serves it. The app itself lives at /feed,
// /spot and the rest, one tap away from the bar at the top of every page.
const nextConfig: NextConfig = {};

export default nextConfig;
