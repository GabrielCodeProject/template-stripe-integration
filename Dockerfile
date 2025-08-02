# syntax=docker/dockerfile:1

# Build arguments for environment variables
ARG NODE_VERSION=18.19.0
ARG ALPINE_VERSION=3.19

# Base image with security hardening
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    dumb-init \
    curl \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Security: Remove package manager caches and temporary files
RUN npm cache clean --force

# Dependencies stage - install production dependencies
FROM base AS deps

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies with security flags
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Builder stage - build the application
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Install all dependencies for build
RUN npm ci --no-audit --no-fund

# Build arguments for build-time environment variables
ARG DATABASE_URL
ARG STRIPE_PUBLISHABLE_KEY
ARG STRIPE_SECRET_KEY
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_APP_URL

# Set environment variables for build
ENV DATABASE_URL=$DATABASE_URL
ENV STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY
ENV STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

# Update Next.js configuration for standalone output
RUN echo 'const nextConfig = { \
  output: "standalone", \
  experimental: { \
    serverComponentsExternalPackages: ["@prisma/client"] \
  }, \
  images: { \
    unoptimized: true \
  } \
}; \
module.exports = nextConfig;' > next.config.js

# Build the application
RUN npm run build

# Runtime stage - create final production image
FROM base AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create necessary directories with proper permissions
RUN mkdir -p .next/cache && \
    mkdir -p public && \
    mkdir -p uploads && \
    mkdir -p logs && \
    chown -R nextjs:nodejs /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Security: Remove unnecessary files and set secure permissions
RUN find /app -name "*.md" -delete && \
    find /app -name "*.txt" -delete && \
    find /app -name "*.log" -delete && \
    chmod -R 755 /app && \
    chmod -R 750 /app/logs

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]