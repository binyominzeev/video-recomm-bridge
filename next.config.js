/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      'assemblyai',
      'openai',
    ],
  },
};

module.exports = nextConfig;
