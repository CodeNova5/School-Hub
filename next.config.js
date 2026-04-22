/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: { unoptimized: true },

  experimental: {
    // Temporary compatibility toggle after Next 14 upgrade.
    missingSuspenseWithCSRBailout: false,
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