import dns from 'dns';

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize clients (these should ideally be singleton instances)
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: HealthCheck[];
  metadata: {
    nodeVersion: string;
    platform: string;
    memory: {
      used: number;
      total: number;
      usage: string;
    };
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1 as test`;

    // Test a simple query
    const result = await prisma.$queryRaw`SELECT version() as version`;

    const responseTime = Date.now() - start;

    return {
      service: 'database',
      status: responseTime < 100 ? 'healthy' : 'degraded',
      responseTime,
      details: {
        type: 'PostgreSQL',
        version: (result as any)[0]?.version || 'unknown',
      },
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Test basic connectivity
    const pong = await redis.ping();

    // Test set/get operations
    const testKey = `health_check_${Date.now()}`;
    await redis.set(testKey, 'test', 'EX', 60);
    const testValue = await redis.get(testKey);
    await redis.del(testKey);

    const responseTime = Date.now() - start;

    return {
      service: 'redis',
      status:
        responseTime < 50 && pong === 'PONG' && testValue === 'test'
          ? 'healthy'
          : 'degraded',
      responseTime,
      details: {
        ping: pong,
        testOperationSuccess: testValue === 'test',
      },
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function checkStripe(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Only perform Stripe check if we have valid credentials
    if (
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes('placeholder')
    ) {
      return {
        service: 'stripe',
        status: 'degraded',
        responseTime: 0,
        details: {
          error: 'Stripe credentials not configured',
        },
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Test basic Stripe API connectivity
    const account = await stripe.accounts.retrieve();

    const responseTime = Date.now() - start;

    return {
      service: 'stripe',
      status: responseTime < 200 ? 'healthy' : 'degraded',
      responseTime,
      details: {
        accountId: account.id,
        country: account.country,
        defaultCurrency: account.default_currency,
      },
    };
  } catch (error) {
    return {
      service: 'stripe',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function checkExternalServices(): Promise<HealthCheck[]> {
  const externalChecks: Promise<HealthCheck>[] = [];

  // Check DNS resolution
  externalChecks.push(
    (async (): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        await new Promise((resolve, reject) => {
          dns.resolve4(
            'stripe.com',
            (err: NodeJS.ErrnoException | null, addresses: string[]) => {
              if (err) {
                reject(err);
              } else {
                resolve(addresses);
              }
            }
          );
        });

        return {
          service: 'dns',
          status: 'healthy',
          responseTime: Date.now() - start,
        };
      } catch (error) {
        return {
          service: 'dns',
          status: 'unhealthy',
          responseTime: Date.now() - start,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    })()
  );

  return Promise.all(externalChecks);
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [dbCheck, redisCheck, stripeCheck, externalChecks] =
      await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkStripe(),
        checkExternalServices(),
      ]);

    const allChecks = [dbCheck, redisCheck, stripeCheck, ...externalChecks];

    // Determine overall status
    const hasUnhealthy = allChecks.some(check => check.status === 'unhealthy');
    const hasDegraded = allChecks.some(check => check.status === 'degraded');

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Get system information
    const memUsage = process.memoryUsage();

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version:
        process.env.npm_package_version || process.env.APP_VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      uptime: Math.floor(process.uptime()),
      checks: allChecks,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          usage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`,
        },
      },
    };

    // Log health check if there are issues
    if (overallStatus !== 'healthy') {
      console.warn('Health check issues detected:', {
        status: overallStatus,
        unhealthyServices: allChecks
          .filter(c => c.status === 'unhealthy')
          .map(c => c.service),
        degradedServices: allChecks
          .filter(c => c.status === 'degraded')
          .map(c => c.service),
      });
    }

    // Return appropriate HTTP status code
    const httpStatus =
      overallStatus === 'healthy'
        ? 200
        : overallStatus === 'degraded'
          ? 200
          : 503;

    return NextResponse.json(healthStatus, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check-Duration': `${Date.now() - startTime}ms`,
        'X-Health-Status': overallStatus,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);

    const errorStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      uptime: Math.floor(process.uptime()),
      checks: [
        {
          service: 'health_check',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      ],
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: 0,
          total: 0,
          usage: '0%',
        },
      },
    };

    return NextResponse.json(errorStatus, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check-Duration': `${Date.now() - startTime}ms`,
        'X-Health-Status': 'unhealthy',
      },
    });
  }
}

// Readiness check - similar to health but focuses on application readiness
export async function HEAD() {
  try {
    // Quick checks for readiness
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();

    return new Response(null, {
      status: 200,
      headers: {
        'X-Ready': 'true',
      },
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Ready': 'false',
      },
    });
  }
}
