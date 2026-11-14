import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  outputFileTracingIncludes: {
    "/**": [
      "./src/data/canonical/surahs/*.json.gz",
      "./src/data/canonical/lexicon-index.json.gz",
      "./src/data/canonical/quran-meta.json",
      "./src/data/canonical/surah-1-fatiha.json",
      "./src/data/manifest.json",
    ],
  },
};

export default nextConfig;
