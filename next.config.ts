import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bnohlikziohzsicnqemo.supabase.co',
      },
    ],
  },
}

export default nextConfig
