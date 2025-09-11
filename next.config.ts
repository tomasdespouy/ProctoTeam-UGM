/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
    serverActions: {
      allowedOrigins: [
        '6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev',
        '6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev:5000',
        '*.replit.dev',
        '*.repl.co',
        'localhost:5000',
        '127.0.0.1:5000',
        '0.0.0.0:5000'
      ],
    },
  },
  // Configure allowed origins for Replit environment
  allowedDevOrigins: [
    '6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev',
    '6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev:5000',
    '*.replit.dev',
    '*.repl.co',
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
  ],
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
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, display-capture=*',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
