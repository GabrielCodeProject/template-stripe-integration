import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'

const prisma = new PrismaClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

interface Metrics {
  timestamp: string
  application: {
    uptime: number
    version: string
    environment: string
    nodeVersion: string
  }
  system: {
    memory: {
      used: number
      total: number
      free: number
      usage: number
    }
    cpu: {
      usage: number
    }
    eventLoop: {
      lag: number
    }
  }
  database: {
    connectionCount: number
    queriesPerSecond: number
    avgResponseTime: number
  }
  redis: {
    connectionCount: number
    memoryUsage: number
    keyCount: number
    commandsProcessed: number
  }
  http: {
    requestCount: number
    averageResponseTime: number
    errorRate: number
  }
  business: {
    activeUsers: number
    paymentsProcessed: number
    revenue: number
  }
}

// Helper function to get event loop lag
function getEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const start = process.hrtime()
    setImmediate(() => {
      const delta = process.hrtime(start)
      const lag = delta[0] * 1000 + delta[1] * 1e-6
      resolve(lag)
    })
  })
}

// Get database metrics
async function getDatabaseMetrics() {
  try {
    // Get active connections
    const connectionResult = await prisma.$queryRaw`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE state = 'active'
    ` as any[]
    
    // Get query statistics (if pg_stat_statements is available)
    const queryStatsResult = await prisma.$queryRaw`
      SELECT 
        COALESCE(sum(calls), 0) as total_calls,
        COALESCE(avg(mean_exec_time), 0) as avg_time
      FROM pg_stat_statements 
      WHERE queryid IS NOT NULL
    `.catch(() => [{ total_calls: 0, avg_time: 0 }]) as any[]
    
    return {
      connectionCount: Number(connectionResult[0]?.active_connections || 0),
      queriesPerSecond: Number(queryStatsResult[0]?.total_calls || 0),
      avgResponseTime: Number(queryStatsResult[0]?.avg_time || 0)
    }
  } catch (error) {
    return {
      connectionCount: 0,
      queriesPerSecond: 0,
      avgResponseTime: 0
    }
  }
}

// Get Redis metrics
async function getRedisMetrics() {
  try {
    const info = await redis.info()
    const infoLines = info.split('\r\n')
    
    const getInfoValue = (key: string): string => {
      const line = infoLines.find(l => l.startsWith(`${key}:`))
      return line ? line.split(':')[1] : '0'
    }
    
    return {
      connectionCount: parseInt(getInfoValue('connected_clients')),
      memoryUsage: parseInt(getInfoValue('used_memory')),
      keyCount: parseInt(getInfoValue('db0')?.split(',')[0]?.split('=')[1] || '0'),
      commandsProcessed: parseInt(getInfoValue('total_commands_processed'))
    }
  } catch (error) {
    return {
      connectionCount: 0,
      memoryUsage: 0,
      keyCount: 0,
      commandsProcessed: 0
    }
  }
}

// Get business metrics
async function getBusinessMetrics() {
  try {
    // Active users in the last 24 hours (example - adjust based on your schema)
    const activeUsers = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM user_sessions 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `.catch(() => [{ count: 0 }]) as any[]
    
    // Payments processed today (example - adjust based on your schema)
    const paymentsToday = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM payments 
      WHERE created_at >= CURRENT_DATE
      AND status = 'succeeded'
    `.catch(() => [{ count: 0, total_amount: 0 }]) as any[]
    
    return {
      activeUsers: Number(activeUsers[0]?.count || 0),
      paymentsProcessed: Number(paymentsToday[0]?.count || 0),
      revenue: Number(paymentsToday[0]?.total_amount || 0)
    }
  } catch (error) {
    return {
      activeUsers: 0,
      paymentsProcessed: 0,
      revenue: 0
    }
  }
}

// Get HTTP metrics from a simple in-memory store (in production, use proper metrics storage)
async function getHttpMetrics() {
  try {
    // Get metrics from Redis (stored by middleware)
    const requestCount = await redis.get('metrics:http:requests:total') || '0'
    const totalResponseTime = await redis.get('metrics:http:response_time:total') || '0'
    const errorCount = await redis.get('metrics:http:errors:total') || '0'
    
    const requests = parseInt(requestCount)
    const errors = parseInt(errorCount)
    const avgResponseTime = requests > 0 ? parseInt(totalResponseTime) / requests : 0
    const errorRate = requests > 0 ? (errors / requests) * 100 : 0
    
    return {
      requestCount: requests,
      averageResponseTime: avgResponseTime,
      errorRate: errorRate
    }
  } catch (error) {
    return {
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0
    }
  }
}

export async function GET() {
  try {
    const startTime = Date.now()
    
    // Get system metrics
    const memUsage = process.memoryUsage()
    const eventLoopLag = await getEventLoopLag()
    
    // Get external metrics
    const [dbMetrics, redisMetrics, businessMetrics, httpMetrics] = await Promise.all([
      getDatabaseMetrics(),
      getRedisMetrics(),
      getBusinessMetrics(),
      getHttpMetrics()
    ])
    
    const metrics: Metrics = {
      timestamp: new Date().toISOString(),
      application: {
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || process.env.APP_VERSION || 'unknown',
        environment: process.env.NODE_ENV || 'unknown',
        nodeVersion: process.version
      },
      system: {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024),
          usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        cpu: {
          usage: 0 // CPU usage calculation would require additional monitoring
        },
        eventLoop: {
          lag: Math.round(eventLoopLag)
        }
      },
      database: dbMetrics,
      redis: redisMetrics,
      http: httpMetrics,
      business: businessMetrics
    }
    
    // Cache metrics for a short time
    await redis.setex('metrics:latest', 30, JSON.stringify(metrics))
    
    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'public, max-age=30',
        'X-Metrics-Generation-Time': `${Date.now() - startTime}ms`
      }
    })
    
  } catch (error) {
    console.error('Metrics collection failed:', error)
    
    return NextResponse.json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
  }
}

// Prometheus-style metrics endpoint
export async function POST() {
  try {
    const metrics = await GET()
    const metricsData = await metrics.json() as Metrics
    
    // Convert to Prometheus format
    const prometheusMetrics = `
# HELP app_uptime_seconds Application uptime in seconds
# TYPE app_uptime_seconds counter
app_uptime_seconds ${metricsData.application.uptime}

# HELP app_memory_used_mb Memory used in MB
# TYPE app_memory_used_mb gauge
app_memory_used_mb ${metricsData.system.memory.used}

# HELP app_memory_usage_percent Memory usage percentage
# TYPE app_memory_usage_percent gauge
app_memory_usage_percent ${metricsData.system.memory.usage}

# HELP app_event_loop_lag_ms Event loop lag in milliseconds
# TYPE app_event_loop_lag_ms gauge
app_event_loop_lag_ms ${metricsData.system.eventLoop.lag}

# HELP db_connections_active Active database connections
# TYPE db_connections_active gauge
db_connections_active ${metricsData.database.connectionCount}

# HELP db_avg_response_time_ms Average database response time in milliseconds
# TYPE db_avg_response_time_ms gauge
db_avg_response_time_ms ${metricsData.database.avgResponseTime}

# HELP redis_connections_active Active Redis connections
# TYPE redis_connections_active gauge
redis_connections_active ${metricsData.redis.connectionCount}

# HELP redis_memory_used_bytes Redis memory usage in bytes
# TYPE redis_memory_used_bytes gauge
redis_memory_used_bytes ${metricsData.redis.memoryUsage}

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metricsData.http.requestCount}

# HELP http_response_time_avg_ms Average HTTP response time in milliseconds
# TYPE http_response_time_avg_ms gauge
http_response_time_avg_ms ${metricsData.http.averageResponseTime}

# HELP http_error_rate_percent HTTP error rate percentage
# TYPE http_error_rate_percent gauge
http_error_rate_percent ${metricsData.http.errorRate}

# HELP business_active_users_24h Active users in the last 24 hours
# TYPE business_active_users_24h gauge
business_active_users_24h ${metricsData.business.activeUsers}

# HELP business_payments_processed_today Payments processed today
# TYPE business_payments_processed_today counter
business_payments_processed_today ${metricsData.business.paymentsProcessed}

# HELP business_revenue_today_cents Revenue today in cents
# TYPE business_revenue_today_cents counter
business_revenue_today_cents ${metricsData.business.revenue}
    `.trim()
    
    return new Response(prometheusMetrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error) {
    return new Response('# Error collecting metrics\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    })
  }
}