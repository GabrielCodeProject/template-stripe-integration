# Database Performance Optimization Guide

## Overview
This document outlines performance optimization strategies for the NextJS Stripe Payment Template database, focusing on query optimization, indexing strategies, and scaling considerations for Canadian e-commerce workloads.

## Indexing Strategy

### Primary Indexes (Already Implemented)

#### User Management
```sql
-- Core user lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_users_email_status ON users(email, status);
CREATE INDEX idx_users_role_status ON users(role, status);
```

#### Product Catalog
```sql
-- Product discovery and filtering
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_price ON products(price);

-- Composite indexes for product listing
CREATE INDEX idx_products_status_featured ON products(status, featured);
CREATE INDEX idx_products_category_status ON products(category_id, status);
CREATE INDEX idx_products_type_status ON products(type, status);
```

#### Order Processing
```sql
-- Order management and analytics
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);

-- Composite indexes for reporting
CREATE INDEX idx_orders_created_at_status ON orders(created_at, status);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);
CREATE INDEX idx_orders_status_total ON orders(status, total_amount);
```

#### Payment Processing
```sql
-- Payment tracking and reconciliation
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Composite indexes for financial reports
CREATE INDEX idx_payments_status_created ON payments(status, created_at);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);
```

#### Subscription Management
```sql
-- Subscription lifecycle management
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- Composite indexes for billing operations
CREATE INDEX idx_subscriptions_status_period_end ON subscriptions(status, current_period_end);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
```

### Advanced Indexing Strategies

#### Partial Indexes for Optimization
```sql
-- Index only active products for public queries
CREATE INDEX idx_products_active_featured ON products(featured, created_at) 
WHERE status = 'ACTIVE';

-- Index only successful payments for financial reports
CREATE INDEX idx_payments_successful_date ON payments(created_at, amount) 
WHERE status = 'SUCCEEDED';

-- Index only active subscriptions for billing
CREATE INDEX idx_subscriptions_active_billing ON subscriptions(current_period_end) 
WHERE status = 'ACTIVE';
```

#### Functional Indexes for Search
```sql
-- Case-insensitive email lookups
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- Full-text search on products
CREATE INDEX idx_products_search ON products 
USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Order number prefix searches
CREATE INDEX idx_orders_number_prefix ON orders(order_number text_pattern_ops);
```

## Query Optimization Patterns

### Efficient Pagination
```typescript
// Use cursor-based pagination for large datasets
const getOrders = async (cursor?: string, limit = 20) => {
  return await prisma.order.findMany({
    where: cursor ? { id: { gt: cursor } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Take one extra to check if there are more
    include: {
      items: {
        include: { product: true }
      },
      user: {
        select: { email: true, firstName: true, lastName: true }
      }
    }
  })
}

// Instead of offset-based pagination (slower for large datasets)
const getOrdersInefficient = async (page = 1, limit = 20) => {
  return await prisma.order.findMany({
    skip: (page - 1) * limit, // Avoid this pattern
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
}
```

### Optimized Aggregations
```typescript
// Use database aggregations instead of application-level calculations
const getReveneueMetrics = async (startDate: Date, endDate: Date) => {
  return await prisma.order.aggregate({
    where: {
      status: 'COMPLETED',
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _sum: { totalAmount: true },
    _avg: { totalAmount: true },
    _count: true
  })
}

// Grouped aggregations for analytics
const getRevenueByMonth = async (year: number) => {
  return await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as order_count,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as avg_order_value
    FROM orders 
    WHERE 
      status = 'COMPLETED' 
      AND EXTRACT(year FROM created_at) = ${year}
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month;
  `
}
```

### Selective Field Loading
```typescript
// Only select fields you need
const getProductListing = async () => {
  return await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      compareAtPrice: true,
      images: {
        where: { isPrimary: true },
        select: { url: true, altText: true }
      }
    },
    orderBy: [
      { featured: 'desc' },
      { createdAt: 'desc' }
    ]
  })
}
```

## Connection Pool Configuration

### Recommended Settings
```typescript
// prisma/schema.prisma datasource configuration
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Connection pool settings in DATABASE_URL
// Example: postgresql://user:password@host:5432/db?connection_limit=20&pool_timeout=30
```

### Environment-Specific Pool Sizes
```bash
# Development
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=5"

# Staging  
DATABASE_URL="postgresql://user:pass@staging:5432/db?connection_limit=10"

# Production
DATABASE_URL="postgresql://user:pass@prod:5432/db?connection_limit=20"
```

## Caching Strategies

### Redis Caching Implementation
```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

// Cache expensive product queries
export const getCachedProducts = async (categoryId?: string) => {
  const cacheKey = `products:${categoryId || 'all'}`
  
  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }
  
  // Query database
  const products = await prisma.product.findMany({
    where: categoryId ? { categoryId, status: 'ACTIVE' } : { status: 'ACTIVE' },
    include: {
      images: { where: { isPrimary: true } },
      category: { select: { name: true, slug: true } }
    }
  })
  
  // Cache for 15 minutes
  await redis.setex(cacheKey, 900, JSON.stringify(products))
  
  return products
}

// Cache user session data
export const cacheUserSession = async (userId: string, sessionData: any) => {
  await redis.setex(`session:${userId}`, 3600, JSON.stringify(sessionData))
}

// Cache analytics data
export const cacheAnalytics = async (key: string, data: any, ttl = 300) => {
  await redis.setex(`analytics:${key}`, ttl, JSON.stringify(data))
}
```

### Application-Level Caching
```typescript
// Use React Query for client-side caching
const useProducts = (categoryId?: string) => {
  return useQuery({
    queryKey: ['products', categoryId],
    queryFn: () => fetchProducts(categoryId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000 // 10 minutes
  })
}

// Next.js ISR for static content
export async function getStaticProps({ params }) {
  const product = await getProduct(params.slug)
  
  return {
    props: { product },
    revalidate: 300 // Revalidate every 5 minutes
  }
}
```

## Database Scaling Strategies

### Read Replicas
```typescript
// Configure read replicas for analytics queries
const readOnlyPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.READ_REPLICA_URL
    }
  }
})

// Use read replica for analytics
export const getAnalyticsData = async () => {
  return await readOnlyPrisma.order.groupBy({
    by: ['status'],
    _sum: { totalAmount: true },
    _count: true
  })
}
```

### Database Partitioning
```sql
-- Partition large tables by date for better performance
CREATE TABLE orders_2024 PARTITION OF orders
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE orders_2025 PARTITION OF orders  
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Partition audit logs by month
CREATE TABLE audit_logs_202401 PARTITION OF audit_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Database Monitoring

#### Key Metrics to Monitor
```sql
-- Query performance monitoring
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Index usage analysis
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;

-- Table size monitoring
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Performance Alerts
```typescript
// Monitor slow queries
const monitorSlowQueries = async () => {
  const slowQueries = await prisma.$queryRaw`
    SELECT query, mean_time, calls 
    FROM pg_stat_statements 
    WHERE mean_time > 1000 -- More than 1 second
    ORDER BY mean_time DESC;
  `
  
  if (slowQueries.length > 0) {
    // Send alert to monitoring system
    await sendAlert('Slow queries detected', slowQueries)
  }
}

// Monitor connection pool usage
const monitorConnections = async () => {
  const connections = await prisma.$queryRaw`
    SELECT count(*) as active_connections
    FROM pg_stat_activity 
    WHERE state = 'active';
  `
  
  if (connections[0].active_connections > 15) {
    await sendAlert('High connection usage', connections)
  }
}
```

## Backup Strategies

### Automated Backups
```bash
#!/bin/bash
# backup-script.sh

# Full database backup
pg_dump $DATABASE_URL > /backups/full_backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > /backups/compressed_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Schema-only backup for migrations
pg_dump --schema-only $DATABASE_URL > /backups/schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Data-only backup
pg_dump --data-only $DATABASE_URL > /backups/data_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Point-in-Time Recovery
```bash
# Enable WAL archiving in postgresql.conf
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'
wal_level = replica

# Create base backup
pg_basebackup -D /backup/base -Ft -z -P

# Restore to specific point in time
pg_ctl stop -D /var/lib/postgresql/data
rm -rf /var/lib/postgresql/data/*
tar -xf /backup/base/base.tar -C /var/lib/postgresql/data
```

## Performance Testing

### Load Testing Queries
```typescript
// Test concurrent order processing
const testOrderLoad = async () => {
  const promises = Array(100).fill(0).map(async (_, i) => {
    return await prisma.order.create({
      data: {
        orderNumber: `TEST-${Date.now()}-${i}`,
        customerEmail: `test${i}@example.com`,
        subtotal: 1000,
        totalAmount: 1130,
        status: 'PENDING'
      }
    })
  })
  
  const startTime = Date.now()
  await Promise.all(promises)
  const endTime = Date.now()
  
  console.log(`Created 100 orders in ${endTime - startTime}ms`)
}

// Test concurrent user registration
const testUserRegistrationLoad = async () => {
  const promises = Array(50).fill(0).map(async (_, i) => {
    return await prisma.user.create({
      data: {
        email: `loadtest${i}@example.com`,
        hashedPassword: 'test',
        firstName: 'Load',
        lastName: `Test${i}`,
        status: 'ACTIVE',
        role: 'CUSTOMER'
      }
    })
  })
  
  const startTime = Date.now()
  await Promise.all(promises)
  const endTime = Date.now()
  
  console.log(`Created 50 users in ${endTime - startTime}ms`)
}
```

## Maintenance Tasks

### Regular Maintenance Schedule
```bash
# Weekly maintenance script
#!/bin/bash

# Update table statistics
psql $DATABASE_URL -c "ANALYZE;"

# Reindex fragmented indexes
psql $DATABASE_URL -c "REINDEX DATABASE ${DB_NAME};"

# Clean up old audit logs (keep 2 years)
psql $DATABASE_URL -c "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '2 years';"

# Clean up old analytics events (keep 1 year)
psql $DATABASE_URL -c "DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '1 year';"

# Vacuum analyze
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

This performance optimization guide ensures your NextJS Stripe Payment Template database scales efficiently with your business growth while maintaining excellent query performance and reliability.