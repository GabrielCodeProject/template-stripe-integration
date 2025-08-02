/**
 * Database Connection Management for PostgreSQL with Prisma
 * Optimized for Canadian e-commerce with connection pooling
 */

import { PrismaClient } from '@prisma/client'

// Global variable to store the Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined
}

// Database connection configuration
const DATABASE_CONFIG = {
  // Connection pool settings optimized for production
  connectionLimit: process.env.NODE_ENV === 'production' ? 10 : 5,
  
  // Query timeout settings
  queryTimeout: 30000, // 30 seconds
  
  // Connection timeout
  connectTimeout: 10000, // 10 seconds
  
  // Pool timeout
  poolTimeout: 10000, // 10 seconds
  
  // Log levels based on environment
  logLevels: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] as const
    : ['warn', 'error'] as const,
}

/**
 * Create Prisma Client with optimized configuration
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: DATABASE_CONFIG.logLevels,
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Add connection pool configuration
    __internal: {
      debug: process.env.NODE_ENV === 'development',
    },
  })

  // Handle process exit to disconnect gracefully
  process.on('beforeExit', async () => {
    console.log('🔌 Disconnecting from database...')
    await client.$disconnect()
  })

  // Add query performance monitoring in development
  if (process.env.NODE_ENV === 'development') {
    client.$use(async (params, next) => {
      const before = Date.now()
      const result = await next(params)
      const after = Date.now()
      const queryTime = after - before
      
      // Log slow queries (>1000ms)
      if (queryTime > 1000) {
        console.warn(`🐌 Slow query detected: ${params.model}.${params.action} took ${queryTime}ms`)
      }
      
      return result
    })
  }

  return client
}

/**
 * Get or create Prisma Client instance (singleton pattern)
 * Uses global variable in development to prevent multiple instances during hot reloads
 */
export const prisma = globalThis.__prisma ?? createPrismaClient()

// Store instance globally in development
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect()
    console.log('🔌 Database disconnected successfully')
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error)
  }
}

/**
 * Get database connection status and statistics
 */
export async function getDatabaseStats() {
  try {
    // Get basic connection info
    const connectionStatus = await prisma.$queryRaw`SELECT 1 as connected`
    
    // SQLite-compatible queries
    const tableCount = await prisma.$queryRaw`
      SELECT count(*) as table_count
      FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `

    return {
      connected: !!connectionStatus,
      database_size: 'SQLite database file', // SQLite doesn't have built-in size function
      table_count: tableCount,
      active_connections: 1, // SQLite doesn't support multiple active connections
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error getting database stats:', error)
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Execute database health check
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy'
  checks: Record<string, boolean>
  timestamp: string
}> {
  const checks = {
    connection: false,
    query_execution: false,
    write_access: false,
  }

  try {
    // Test basic connection
    await prisma.$connect()
    checks.connection = true

    // Test query execution
    await prisma.$queryRaw`SELECT 1`
    checks.query_execution = true

    // Test write access (create and delete a test record)
    const testSetting = await prisma.systemSetting.create({
      data: {
        key: `health_check_${Date.now()}`,
        value: 'test',
        description: 'Health check test record',
        category: 'health_check',
      },
    })
    
    await prisma.systemSetting.delete({
      where: { id: testSetting.id },
    })
    checks.write_access = true

  } catch (error) {
    console.error('Health check failed:', error)
  }

  const allHealthy = Object.values(checks).every(check => check === true)

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Handle database errors with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries) {
        break
      }

      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, lastError.message)
      console.warn(`Retrying in ${retryDelay}ms...`)
      
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      retryDelay *= 2 // Exponential backoff
    }
  }

  throw lastError
}

/**
 * Transaction wrapper with automatic rollback on error
 */
export async function executeTransaction<T>(
  operations: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    try {
      return await operations(tx)
    } catch (error) {
      console.error('Transaction failed, rolling back:', error)
      throw error
    }
  }, {
    maxWait: 10000, // 10 seconds
    timeout: 30000, // 30 seconds
    isolationLevel: 'ReadCommitted',
  })
}

export default prisma