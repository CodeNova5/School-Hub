/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: { unoptimized: true },

  experimental: {
    serverActions: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "x-school-id", value: "" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;