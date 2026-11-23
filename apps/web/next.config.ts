import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fcm/prisma", "@fcm/shared"],
};

export default nextConfig;
