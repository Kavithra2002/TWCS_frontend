/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // Reduces the number of atomic temp-file writes that trigger the Windows
    // Defender race condition (ENOENT on _buildManifest.js.tmp.*).
    optimizePackageImports: ['recharts', 'date-fns', 'lucide-react'],
  },

  // Keep route compilations in memory for the whole dev session so navigating
  // between pages never triggers a rebuild.
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 50,
  },

};

export default nextConfig;
