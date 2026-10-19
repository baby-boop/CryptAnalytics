import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const config = (phase: string): NextConfig => {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  const origin =
    process.env.API_ORIGIN ??
    `http://127.0.0.1:${process.env.API_PORT ?? process.env.PORT ?? 3001}`;
  return {
    output: development ? undefined : "export",
    trailingSlash: true,
    images: { unoptimized: true },
    ...(development
      ? {
          async rewrites() {
            return [
              { source: "/api/:path*", destination: `${origin}/api/:path*` },
            ];
          },
        }
      : {}),
  };
};

export default config;
