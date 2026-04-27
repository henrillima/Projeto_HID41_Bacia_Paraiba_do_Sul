import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necessário para react-leaflet (SSR incompatível com window)
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};

export default nextConfig;
