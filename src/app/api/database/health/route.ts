/**
 * Database Health Check API Route
 * Provides detailed health status and statistics for the PostgreSQL database
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseStats, performHealthCheck } from '@/lib/database/connection'

export async function GET(request: NextRequest) {
  try {
    // Get database statistics and health check
    const [stats, healthCheck] = await Promise.all([
      getDatabaseStats(),
      performHealthCheck(),
    ])

    // Combine results
    const response = {
      timestamp: new Date().toISOString(),
      status: healthCheck.status,
      database: {
        connected: stats.connected,
        ...('database_size' in stats ? stats : {}),
      },
      checks: healthCheck.checks,
      environment: process.env.NODE_ENV,
    }

    // Return appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503

    return NextResponse.json(response, { status: statusCode })
  } catch (error) {
    console.error('Database health check failed:', error)
    
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
      },
      { status: 503 }
    )
  }
}

// Support HEAD requests for simple health checks
export async function HEAD(request: NextRequest) {
  try {
    const healthCheck = await performHealthCheck()
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503
    return new NextResponse(null, { status: statusCode })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}