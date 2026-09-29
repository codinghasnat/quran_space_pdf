import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server from a phone on the same network
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
