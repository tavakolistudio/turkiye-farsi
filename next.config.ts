import type { NextConfig } from "next";

function storageImagePattern(): URL[] {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return [];
  try {
    const origin = new URL(configured);
    if (origin.protocol !== "https:") return [];
    return [new URL("/storage/v1/object/public/**", origin)];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: storageImagePattern(),
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86_400,
    maximumRedirects: 0,
    maximumResponseBody: 10_000_000,
  },
  async headers() {
    return [{
      source: "/preview/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      ],
    }];
  },
};

export default nextConfig;
