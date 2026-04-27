/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necessário para react-leaflet (SSR incompatível com window)
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};

export default nextConfig;
