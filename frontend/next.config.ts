import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The Express backend runs separately (default port 3000). The frontend
  // calls it through NEXT_PUBLIC_API_URL; no backend code is touched here.
};

export default nextConfig;
