/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },

  // ---------------------------------------------------------------------------
  // Subdomain support
  // In Vercel, add a wildcard domain: *.myapp.com → your deployment
  // In local dev, use /etc/hosts aliases like school1.localhost or
  // set NEXT_PUBLIC_APP_DOMAIN=localhost in .env.local
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        // Pass x-school-id from middleware to all API routes and pages
        source: "/(.*)",
        headers: [
          { key: "x-school-id", value: "" }, // placeholder; real value set by middleware
        ],
      },
    ];
  },
};

module.exports = nextConfig;

