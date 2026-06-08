import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

function supabaseStorageRemotePatterns(): RemotePattern[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return [];
  try {
    const { protocol, hostname } = new URL(url);
    if (hostname) {
      return [
        {
          protocol: protocol === "http:" ? "http" : "https",
          hostname,
          pathname: "/storage/v1/object/**",
        },
      ];
    }
  } catch {
    /* ignore invalid URL */
  }
  return [];
}

const googleAvatarPatterns = (): RemotePattern[] => [
  { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [...supabaseStorageRemotePatterns(), ...googleAvatarPatterns()],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
