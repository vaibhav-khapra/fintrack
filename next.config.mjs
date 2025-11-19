/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        turbo: {}, // optional
    },
    images: {
        domains: ['yourdomain.com'], // optional
    },
};

export default nextConfig;
