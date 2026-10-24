import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.join(__dirname, '../'),
  },
  async rewrites() {
    return [
      {
        source: '/Roboto-Regular.ttf',
        destination: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2',
      },
      {
        source: '/:locale/Roboto-Regular.ttf',
        locale: false,
        destination: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard/settings',
        destination: '/dashboard/admin',
        permanent: false,
      },
      {
        source: '/dashboard/users',
        destination: '/dashboard/admin',
        permanent: false,
      },
      {
        source: '/dashboard/courses/manage',
        destination: '/dashboard/admin/courses',
        permanent: true,
      },
      {
        source: '/dashboard/finance',
        destination: '/dashboard/admin/finance',
        permanent: true,
      },
      {
        source: '/dashboard/instructors-hr',
        destination: '/dashboard/admin/instructors',
        permanent: true,
      },
      {
        source: '/dashboard/audit-logs',
        destination: '/dashboard/admin/audit',
        permanent: true,
      }
    ];
  }
};

export default nextConfig;
