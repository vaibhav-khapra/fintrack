// next.config.js
const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    fallbacks: {
      document: '/offline', // fallback for document/html pages
      image: '/images/offline.png', // fallback for image requests
      font: false // disable font fallback
    }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: ['fintrack-livid.vercel.app'],
    },
};

module.exports = withPWA(nextConfig);
