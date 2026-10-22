import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
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
