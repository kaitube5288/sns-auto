import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    domains: ['graph.facebook.com', 'scontent.cdninstagram.com'],
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
}

export default nextConfig
