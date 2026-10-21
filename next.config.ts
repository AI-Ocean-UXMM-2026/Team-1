import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // REACT_COMPILER=off lets e2e runs A/B-test compiler interference.
  reactCompiler: process.env.REACT_COMPILER === "off" ? false : true,
  // e2e tests run a second dev server on port 3100 while `next dev` may
  // already be running; each server needs its own lockfile, which lives in
  // the dist dir.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/welcome",
        permanent: false,
      },
      {
        source: "/manager",
        destination: "/manager/home",
        permanent: false,
      },
      {
        source: "/rider",
        destination: "/rider/route",
        permanent: false,
      },
      {
        source: "/rider/cod",
        destination: "/rider/route",
        permanent: false,
      },
      {
        source: "/rider/deliveries",
        destination: "/rider/route",
        permanent: false,
      },
      {
        source: "/rider/profile",
        destination: "/rider/route",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
