/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  // Build optimizations
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Skip type checking during development builds
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  // Skip ESLint during development builds
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
}

module.exports = nextConfig
