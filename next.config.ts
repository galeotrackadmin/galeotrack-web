import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['echarts', 'zrender'],
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ] },
      { source: '/sw.js', headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'CDN-Cache-Control', value: 'no-store' },
        { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        { key: 'Service-Worker-Allowed', value: '/' },
        { key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'self'; connect-src 'self'" },
      ] },
      { source: '/offline.html', headers: [
        { key: 'Content-Security-Policy', value: "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" },
        { key: 'X-Robots-Tag', value: 'noindex' },
      ] },
      { source: '/api/:path*', headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'CDN-Cache-Control', value: 'no-store' },
        { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
      ] },
    ]
  },
};

export default nextConfig;
