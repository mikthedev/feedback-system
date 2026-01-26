/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Allow iframe embedding from any origin (for Framer)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *; frame-src https://w.soundcloud.com https://soundcloud.com;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
