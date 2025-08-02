# Database Setup Guide - NextJS Stripe Payment Template

## Overview
This guide provides step-by-step instructions for setting up the PostgreSQL database with Prisma ORM for the NextJS Stripe Payment Template, including Canadian compliance requirements.

## Prerequisites

### Required Software
- **Node.js**: Version 18+ LTS
- **PostgreSQL**: Version 15+ 
- **Redis**: Version 7+ (for caching and sessions)
- **Git**: For version control

### Development Environment Setup
```bash
# Install Node.js (using nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install PostgreSQL (macOS with Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Install Redis (Ubuntu/Debian)
sudo apt install redis-server

# Install Redis (macOS with Homebrew)
brew install redis
brew services start redis
```

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE stripe_template;
CREATE USER stripe_user WITH ENCRYPTED PASSWORD 'secure_password_here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE stripe_template TO stripe_user;
GRANT ALL ON SCHEMA public TO stripe_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stripe_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stripe_user;

# Enable required extensions
\c stripe_template
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

# Exit PostgreSQL
\q
```

### 2. Environment Configuration

Create `.env.local` file in your project root:
```bash
cp .env.example .env.local
```

Update the database connection string:
```env
DATABASE_URL="postgresql://stripe_user:secure_password_here@localhost:5432/stripe_template"
REDIS_URL="redis://localhost:6379"
ENCRYPTION_KEY="your-32-character-encryption-key-here"
```

### 3. Install Dependencies

```bash
# Install main project dependencies
npm install

# Install Prisma dependencies
cd prisma
npm install
```

### 4. Generate Prisma Client

```bash
# Generate Prisma client from schema
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Or run migrations (recommended for production)
npx prisma migrate dev --name init
```

### 5. Seed Database

```bash
# Run seed script to populate initial data
cd prisma
npm run db:seed

# Or directly with tsx
npx tsx seed.ts
```

## Production Setup

### 1. PostgreSQL Production Configuration

#### Recommended postgresql.conf Settings
```conf
# Connection settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# WAL settings for backup and replication
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 10
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'

# Logging
log_statement = 'mod'
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Security
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

#### Production Environment Variables
```env
NODE_ENV=production
DATABASE_URL="postgresql://prod_user:secure_prod_password@prod-db:5432/stripe_template_prod?sslmode=require"
READ_REPLICA_URL="postgresql://read_user:read_password@read-replica:5432/stripe_template_prod?sslmode=require"
```

### 2. Deploy Migrations

```bash
# Deploy migrations to production
npx prisma migrate deploy

# Generate Prisma client for production
npx prisma generate
```

### 3. Production Seed (Safe Mode)

```bash
# Run production-safe seeding (no sample data)
NODE_ENV=production npx tsx seed.ts
```

## Database Maintenance

### Daily Maintenance Tasks

```bash
#!/bin/bash
# daily-maintenance.sh

echo "Starting daily database maintenance..."

# Update table statistics
psql $DATABASE_URL -c "ANALYZE;"

# Clean up old sessions (older than 30 days)
psql $DATABASE_URL -c "DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '30 days';"

# Clean up expired download links
psql $DATABASE_URL -c "UPDATE downloads SET is_active = false WHERE expires_at < NOW() AND is_active = true;"

# Update search indexes
psql $DATABASE_URL -c "REINDEX INDEX CONCURRENTLY idx_products_search;"

echo "Daily maintenance completed."
```

### Weekly Maintenance Tasks

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Starting weekly database maintenance..."

# Full vacuum analyze
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Clean up old audit logs (keep 2 years)
psql $DATABASE_URL -c "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '2 years';"

# Clean up old analytics events (keep 1 year)
psql $DATABASE_URL -c "DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '1 year';"

# Reindex all tables
psql $DATABASE_URL -c "REINDEX DATABASE ${DB_NAME};"

echo "Weekly maintenance completed."
```

## Performance Monitoring

### Key Metrics to Monitor

```sql
-- Monitor slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Monitor table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Monitor index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_tup_read / nullif(idx_tup_fetch, 0) as ratio
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;

-- Monitor connection count
SELECT 
  count(*) as total_connections,
  count(*) filter (where state = 'active') as active_connections,
  count(*) filter (where state = 'idle') as idle_connections
FROM pg_stat_activity;
```

### Automated Monitoring Script

```bash
#!/bin/bash
# monitor-database.sh

# Database performance monitoring
echo "Database Performance Report - $(date)"
echo "======================================"

# Check connection count
ACTIVE_CONNECTIONS=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
echo "Active Connections: $ACTIVE_CONNECTIONS"

if [ "$ACTIVE_CONNECTIONS" -gt 80 ]; then
    echo "WARNING: High connection count detected!"
    # Send alert to monitoring system
fi

# Check database size
DB_SIZE=$(psql $DATABASE_URL -tAc "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
echo "Database Size: $DB_SIZE"

# Check for long-running queries
LONG_QUERIES=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '1 minute';")
echo "Long Running Queries (>1min): $LONG_QUERIES"

if [ "$LONG_QUERIES" -gt 0 ]; then
    echo "WARNING: Long running queries detected!"
    psql $DATABASE_URL -c "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '1 minute';"
fi

echo "======================================"
```

## Backup and Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backup/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create full database backup
echo "Creating database backup..."
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Verify backup
if [ -f "$BACKUP_FILE.gz" ]; then
    echo "Backup created successfully: $BACKUP_FILE.gz"
    
    # Upload to cloud storage (optional)
    # aws s3 cp "$BACKUP_FILE.gz" s3://your-backup-bucket/database/
    
    # Clean up old backups (keep 30 days)
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
    
else
    echo "ERROR: Backup failed!"
    exit 1
fi
```

### Recovery Procedure

```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

echo "WARNING: This will completely replace the current database!"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Stop application
    echo "Stopping application..."
    # systemctl stop your-app
    
    # Drop and recreate database
    echo "Recreating database..."
    psql -c "DROP DATABASE IF EXISTS stripe_template;"
    psql -c "CREATE DATABASE stripe_template;"
    
    # Restore from backup
    echo "Restoring from backup..."
    gunzip -c $BACKUP_FILE | psql $DATABASE_URL
    
    # Run any necessary migrations
    echo "Running migrations..."
    npx prisma migrate deploy
    
    # Restart application
    echo "Starting application..."
    # systemctl start your-app
    
    echo "Database restoration completed!"
else
    echo "Restoration cancelled."
fi
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Connection refused" error
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL if stopped
sudo systemctl start postgresql

# Check if port 5432 is listening
netstat -ln | grep 5432
```

#### Issue: "relation does not exist" error
```bash
# Reset database and run migrations
npx prisma migrate reset

# Or push schema directly (development only)
npx prisma db push
```

#### Issue: Permission denied errors
```sql
-- Connect as superuser and fix permissions
\c stripe_template postgres

GRANT ALL PRIVILEGES ON DATABASE stripe_template TO stripe_user;
GRANT ALL ON SCHEMA public TO stripe_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stripe_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stripe_user;

-- For future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO stripe_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO stripe_user;
```

#### Issue: Slow query performance
```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Check for missing indexes
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_tup_read DESC;
```

### Performance Optimization

#### Query Optimization
```sql
-- Use EXPLAIN ANALYZE to understand query performance
EXPLAIN ANALYZE SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '30 days';

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_orders_created_at_recent 
ON orders(created_at) 
WHERE created_at > NOW() - INTERVAL '1 year';
```

#### Connection Pool Tuning
```typescript
// Configure Prisma connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
})

// Configure connection pool size based on environment
const connectionLimit = process.env.NODE_ENV === 'production' ? 20 : 5
```

## Canadian Compliance Setup

### Tax Rate Configuration
The seed script automatically configures Canadian tax rates for all provinces. Verify the setup:

```sql
-- Check tax rates are properly configured
SELECT province, tax_type, rate, name, is_active 
FROM tax_rates 
ORDER BY province, tax_type;

-- Update tax rates if needed (quarterly review recommended)
UPDATE tax_rates 
SET rate = 0.13, updated_at = NOW() 
WHERE province = 'ON' AND tax_type = 'HST';
```

### Audit Logging Verification
```sql
-- Verify audit logging is working
SELECT action, resource, count(*) 
FROM audit_logs 
GROUP BY action, resource 
ORDER BY count DESC;

-- Check audit log retention
SELECT 
  DATE_TRUNC('month', created_at) as month,
  count(*) as log_count
FROM audit_logs 
GROUP BY month 
ORDER BY month DESC;
```

This comprehensive setup guide ensures your database is properly configured for the NextJS Stripe Payment Template with Canadian compliance requirements and production-ready performance optimization.