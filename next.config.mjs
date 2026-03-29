/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.1.110", "172.16.0.2", "localhost"],
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
