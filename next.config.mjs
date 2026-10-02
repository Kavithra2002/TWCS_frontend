/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // recharts is a large barrel import. This keeps the first compile of
    // chart pages from pulling the whole package in.
    optimizePackageImports: ['recharts', 'date-fns', 'lucide-react'],
  },
  // Dev compiles each route the first time it is opened. Keep those
  // compilations for the session so moving between pages does not rebuild them.
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 50,
  },
};

export default nextConfig;
