import { withPWA } from 'next-pwa';

const config = {
    reactStrictMode: true,
    experimental: {
        turbo: {}, // Turbopack support
    },
    images: {
        domains: ['yourdomain.com'], // optional
    },
};

export default withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
})(config);
