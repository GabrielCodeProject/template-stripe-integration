# Database Setup Guide

## Overview

This guide covers the complete database infrastructure setup for the NextJS Stripe Payment Template with Canadian compliance features.

## 🏗️ Architecture

### Technology Stack
- **Database**: PostgreSQL 15+ with Alpine Linux
- **ORM**: Prisma Client v6.13.0
- **Connection Pooling**: Built-in Prisma connection management
- **Caching**: Redis for session storage and caching
- **Backup**: Automated backup scripts with S3 integration

### Canadian Compliance Features
- ✅ Canadian postal code validation
- ✅ Province-specific tax calculations (GST, HST, PST, QST)
- ✅ Multi-currency support (CAD primary)
- ✅ Audit logging for compliance
- ✅ Address validation for all Canadian provinces/territories

## 🚀 Quick Start

### 1. Environment Setup

Copy the environment template:
```bash
cp .env.example .env.local
```

Update the database configuration in `.env.local`:
```env
# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/stripe_template_dev?schema=public
POSTGRES_DB=stripe_template_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
```

### 2. Start Database Services

```bash
# Start PostgreSQL and Redis containers
docker-compose up -d postgres redis

# Wait for services to be ready
docker-compose logs -f postgres
```

### 3. Initialize Database

```bash
# Run the automated setup script
npm run db:setup

# Or manually:
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Verify Setup

```bash
# Check database health
curl http://localhost:3000/api/database/health

# Open Prisma Studio to browse data
npm run db:studio
```

## 📊 Database Schema

### Core Models

#### User Management
- **Users**: Customer accounts with Canadian address support
- **Sessions**: Authentication session management
- **Addresses**: Canadian postal addresses with province validation

#### Product Catalog
- **Products**: Digital and physical products with Canadian pricing
- **Categories**: Hierarchical product organization
- **ProductVariants**: Size, color, flavor variations
- **ProductImages**: Multiple product images with primary designation

#### Order Processing
- **Orders**: Complete order lifecycle with Canadian tax calculation
- **OrderItems**: Individual line items with download access
- **Payments**: Stripe payment integration with fee tracking
- **Refunds**: Comprehensive refund management

#### Canadian Tax System
- **TaxRates**: Province-specific tax rates (GST, HST, PST, QST)
- **Tax Calculation**: Automatic tax calculation based on shipping address

#### Subscription Management
- **SubscriptionPlans**: Recurring billing plans
- **Subscriptions**: Active subscription tracking
- **Invoices**: Automated invoice generation

### Canadian Tax Implementation

```typescript
// Example tax calculation for Ontario (HST)
const taxCalculation = await calculateCanadianTax(
  CanadianProvince.ON,
  10000, // $100.00 in cents
  new Date()
);

// Result:
{
  subtotal: 10000,      // $100.00
  hst: 1300,           // $13.00 (13% HST)
  totalTax: 1300,
  grandTotal: 11300,    // $113.00
  breakdown: [
    {
      type: "HST",
      name: "Ontario HST",
      rate: 0.13,
      amount: 1300
    }
  ]
}
```

## 🔧 Configuration

### Connection Management

The database connection is configured with:
- **Connection Pooling**: Optimized for production (10 connections) and development (5 connections)
- **Query Timeout**: 30 seconds for complex operations
- **Retry Logic**: Exponential backoff for failed connections
- **Health Monitoring**: Automated health checks with performance metrics

### Performance Optimization

#### Indexes
The schema includes comprehensive indexing for:
- User lookups (email, Stripe customer ID)
- Order analytics (date ranges, status filtering)
- Product catalog (search, filtering, categorization)
- Payment processing (transaction tracking)
- Canadian compliance (province-based queries)

#### Query Optimization
```typescript
// Efficient product search with Canadian tax calculation
const products = await prisma.product.findMany({
  where: {
    status: 'ACTIVE',
    category: {
      isActive: true
    }
  },
  include: {
    category: true,
    images: {
      where: { isPrimary: true },
      take: 1
    },
    variants: {
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    }
  },
  orderBy: [
    { featured: 'desc' },
    { createdAt: 'desc' }
  ]
});
```

## 🔒 Security & Compliance

### Data Protection
- **Encryption**: Sensitive data encrypted at rest
- **Audit Logging**: All critical operations logged
- **Access Control**: Role-based permissions (Admin, Customer, Support)
- **Data Retention**: Configurable retention policies

### Canadian Compliance
- **Privacy Act**: User consent and data handling
- **PIPEDA**: Personal information protection
- **CRA Requirements**: Tax calculation and reporting
- **Provincial Regulations**: Province-specific business rules

### Backup Strategy
```bash
# Full backup (recommended for production)
npm run backup

# Database only
npm run backup:db

# Restore from backup
npm run restore path/to/backup.sql.gz
```

## 🚀 Deployment

### Development
```bash
docker-compose up -d
npm run dev
```

### Staging
```bash
ENVIRONMENT=staging docker-compose -f docker-compose.staging.yml up -d
```

### Production
```bash
ENVIRONMENT=production docker-compose -f docker-compose.prod.yml up -d
```

## 📈 Monitoring

### Health Checks
- **Endpoint**: `GET /api/database/health`
- **Response Time**: Database query performance
- **Connection Status**: Active connections and pool usage
- **Storage Metrics**: Database size and growth

### Alerting
Configure monitoring for:
- Database connection failures
- Slow query performance (>1000ms)
- High connection pool usage (>80%)
- Failed backup operations

## 🛠️ Maintenance

### Regular Tasks

#### Daily
- Monitor database performance
- Check backup completion
- Review error logs

#### Weekly
- Analyze slow queries
- Update statistics
- Clean temporary data

#### Monthly
- Review storage growth
- Optimize indexes
- Security audit

### Database Migrations

```bash
# Create new migration
npx prisma migrate dev --name add_new_feature

# Deploy to production
npx prisma migrate deploy

# Reset development database
npx prisma migrate reset
```

### Performance Tuning

```sql
-- Monitor slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;
```

## 🤝 API Integration

### Database Utilities

```typescript
import { prisma, executeTransaction } from '@/lib/database/connection';
import { calculateCanadianTax, validateCanadianPostalCode } from '@/lib/database/utils';

// Transaction example
const result = await executeTransaction(async (tx) => {
  const order = await tx.order.create({ /* order data */ });
  const payment = await tx.payment.create({ /* payment data */ });
  return { order, payment };
});

// Tax calculation
const taxInfo = await calculateCanadianTax(
  CanadianProvince.BC,
  subtotal
);

// Postal code validation
const validation = validateCanadianPostalCode('V6B 1A1');
```

## 🔍 Troubleshooting

### Common Issues

#### Connection Refused
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart services
docker-compose restart postgres
```

#### Migration Failures
```bash
# Check migration status
npx prisma migrate status

# Reset and re-apply
npx prisma migrate reset
npx prisma migrate dev
```

#### Performance Issues
```bash
# Check connection pool
curl http://localhost:3000/api/database/health

# Monitor queries in development
DEBUG=prisma:query npm run dev
```

### Support

For additional support:
1. Check the [troubleshooting guide](./troubleshooting.md)
2. Review [performance optimization](./database-performance-optimization.md)
3. Contact the development team

## 📝 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Canadian Tax Compliance Guide](./canadian-tax-compliance.md)
- [Database Security Checklist](./database-security.md)