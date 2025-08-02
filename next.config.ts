/**
 * Next.js Configuration for Stripe Integration Template
 * 
 * This configuration includes:
 * - Comprehensive security headers for payment processing compliance
 * - Stripe-specific CSP policies for payment forms and billing portals
 * - Image optimization with support for external Stripe domains
 * - Production optimizations for bundle splitting and caching
 * - Canadian compliance considerations (PIPEDA, privacy)
 * - Bundle analyzer support for performance monitoring
 * 
 * Security Features:
 * - Content Security Policy (CSP) with Stripe domain allowlist
 * - X-Frame-Options for clickjacking protection
 * - HSTS for HTTPS enforcement in production
 * - Cross-Origin policies for enhanced security
 * - XSS protection and MIME type validation
 * 
 * Performance Features:
 * - AVIF/WebP image optimization
 * - Aggressive caching for static assets
 * - Bundle splitting for Stripe libraries
 * - Compression and minification
 * - Standalone output for containerized deployments
 */

import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Enable TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ["src"],
  },

  // Experimental features for Next.js 15
  experimental: {
    // Server component logs - improve debugging in development
    serverComponentsExternalPackages: ["@prisma/client"],
    // Optimize package imports for better bundle splitting
    optimizePackageImports: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
    // Enable turbo mode for faster development builds
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      // Stripe domains for payment processing
      "files.stripe.com",
      "dashboard.stripe.com",
      "connect.stripe.com",
      // Common CDN domains for user content
      "cdn.stripe.com",
      "images.stripe.com",
      // Add your domain here
      ...(process.env.NEXT_PUBLIC_APP_DOMAIN ? [process.env.NEXT_PUBLIC_APP_DOMAIN] : []),
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.stripe.com",
      },
      {
        protocol: "https",
        hostname: "dashboard.stripe.com",
      },
      {
        protocol: "https",
        hostname: "files.stripe.com",
      },
    ],
    minimumCacheTTL: 31536000, // 1 year for optimized images
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: isDevelopment,
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Optimize bundle size
    if (isProduction) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          stripe: {
            test: /[\\/]node_modules[\\/](@stripe|stripe)[\\/]/,
            name: "stripe",
            chunks: "all",
            priority: 20,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
        },
      };
    }

    // Ignore certain packages on server side
    if (isServer) {
      config.externals.push("bcryptjs");
    }

    return config;
  },

  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,

  // Security headers
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect.stripe.com https://checkout.stripe.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://connect.stripe.com;
      img-src 'self' blob: data: https://*.stripe.com https://files.stripe.com https://dashboard.stripe.com;
      font-src 'self' https://fonts.gstatic.com https://connect.stripe.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self' https://checkout.stripe.com https://connect.stripe.com;
      frame-ancestors 'none';
      frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://connect.stripe.com;
      connect-src 'self' https://api.stripe.com https://connect.stripe.com https://checkout.stripe.com https://files.stripe.com wss://ws.stripe.com;
      worker-src 'self' blob:;
      child-src 'self' https://js.stripe.com;
      manifest-src 'self';
      media-src 'self';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, " ").trim();

    const securityHeaders = [
      // Content Security Policy
      {
        key: "Content-Security-Policy",
        value: cspHeader,
      },
      // Prevent embedding in frames (clickjacking protection)
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      // Prevent MIME type sniffing
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      // Enable XSS filtering
      {
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      // Control referrer information
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      // Permissions Policy (Feature Policy)
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=*, fullscreen=(self), display-capture=()",
      },
      // Force HTTPS in production
      ...(isProduction
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ]
        : []),
      // Additional security headers for Canadian compliance (PIPEDA)
      {
        key: "X-Permitted-Cross-Domain-Policies",
        value: "none",
      },
      {
        key: "Cross-Origin-Embedder-Policy",
        value: "credentialless",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: "same-origin",
      },
      // Cache control for security
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Specific headers for API routes
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      // Less restrictive CSP for Stripe-related pages
      {
        source: "/(checkout|billing|payment)/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(
              "frame-ancestors 'none';",
              "frame-ancestors 'self' https://checkout.stripe.com https://connect.stripe.com;"
            ),
          },
          ...securityHeaders.filter((header) => header.key !== "Content-Security-Policy"),
        ],
      },
      // Static assets caching
      {
        source: "/(.*\\.(js|css|woff|woff2|ttf|otf|eot|ico|png|jpg|jpeg|gif|svg|webp|avif))",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Redirects for security and SEO
  async redirects() {
    return [
      // Force HTTPS in production
      ...(isProduction
        ? [
            {
              source: "/:path*",
              has: [
                {
                  type: "header",
                  key: "x-forwarded-proto",
                  value: "http",
                },
              ],
              destination: "https://:host/:path*",
              permanent: true,
            },
          ]
        : []),
      // Redirect old payment URLs for consistency
      {
        source: "/payments/:path*",
        destination: "/payment/:path*",
        permanent: true,
      },
    ];
  },

  // Rewrites for API versioning and clean URLs
  async rewrites() {
    return {
      beforeFiles: [
        // API versioning
        {
          source: "/api/v1/:path*",
          destination: "/api/:path*",
        },
      ],
      afterFiles: [
        // Stripe webhook handling
        {
          source: "/stripe/webhook",
          destination: "/api/webhooks/stripe",
        },
      ],
      fallback: [],
    };
  },

  // Bundle analyzer for production optimization
  ...(process.env.ANALYZE === "true" && {
    bundleAnalyzer: {
      enabled: true,
      openAnalyzer: true,
    },
  }),

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: isDevelopment,
    },
  },

  // Output configuration for different deployment targets
  output: process.env.NEXT_OUTPUT || "standalone",

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
