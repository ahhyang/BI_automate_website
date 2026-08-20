import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "postgres",
    "mammoth",
    "unpdf",
    "sharp",
    "bcryptjs",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
};

export default nextConfig;
