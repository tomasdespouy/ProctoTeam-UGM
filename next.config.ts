/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    optimizePackageImports: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
    // Origen de Server Actions: same-origin en producción (Vercel) + localhost en
    // dev. Se quitaron los orígenes *.replit.dev heredados del prototipo.
    serverActions: {
      allowedOrigins: ['localhost:3000', '127.0.0.1:3000'],
    },
  },
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // Optimize chunk loading for heavy ML libraries
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          tensorflow: {
            test: /[\\/]node_modules[\\/](@tensorflow|@tensorflow-models)[\\/]/,
            name: 'tensorflow',
            chunks: 'async',
            priority: 30,
          },
        },
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.postimg.cc',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Cámara/micrófono/pantalla solo para el propio origen (no se delegan
            // a iframes de terceros anidados).
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), display-capture=(self)',
          },
          {
            // CSP acotada y SEGURA para no romper proctoring (MediaPipe/TF/WASM,
            // Supabase realtime, Azure): solo endurece anti-clickjacking, <object>
            // y <base>. Una CSP con script-src estricta queda como follow-up
            // (requiere probar contra los CDN de ML en runtime).
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Keep a usable handle to the MSAL login popup so its window.closed
            // monitor works (otherwise COOP blocks it and the popup flow hangs).
            // "allow-popups" stays non-isolating: no COEP is set and the app never
            // becomes crossOriginIsolated, so the cross-origin MediaPipe CDN WASM
            // still loads and proctoring (camera/screen-share) is unaffected.
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
