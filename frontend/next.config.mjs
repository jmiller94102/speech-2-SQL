/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    typedRoutes: true,
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
