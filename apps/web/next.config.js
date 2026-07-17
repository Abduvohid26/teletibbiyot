/** @type {import('next').NextConfig} */
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch {
  // dotenv ixtiyoriy — Next o'zi ham env o'qiydi
}

const nextConfig = {
  transpilePackages: ['@ishifo/shared'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Socket.IO "/socket.io/?EIO=4..." ni oxirgi "/" bilan so'raydi. Next.js sukut bo'yicha
  // uni "/socket.io?EIO=4..." ga 308 bilan yo'naltiradi — socket.io klienti bu redirectni
  // kuzatmaydi va ulanish uziladi (pastdagi /socket.io rewrite umuman ishlamaydi).
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_E2E: process.env.E2E === 'true' ? 'true' : '',
  },
  async rewrites() {
    const isProd = process.env.NODE_ENV === 'production';
    let origin =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL;

    // Local `next dev` hostda docker hostname `api` ishlamaydi
    if (!isProd && origin && /^https?:\/\/api(?::|\/|$)/.test(origin)) {
      origin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }

    if (isProd && !origin) {
      throw new Error(
        'INTERNAL_API_URL yoki NEXT_PUBLIC_API_URL production build uchun majburiy',
      );
    }
    origin = origin || 'http://localhost:3001';
    return [
      { source: '/api/:path*', destination: `${origin}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${origin}/socket.io/:path*` },
      { source: '/favicon.ico', destination: '/favicon.svg' },
      { source: '/error', destination: '/login' },
      { source: '/auth', destination: '/login' },
      { source: '/auth/:path*', destination: '/login' },
    ];
  },
};

module.exports = nextConfig;
