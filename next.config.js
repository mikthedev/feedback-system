/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow iframe embedding from any origin (for Framer)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *; frame-src https://w.soundcloud.com https://soundcloud.com https://player.twitch.tv https://embed.twitch.tv https://www.twitch.tv;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
