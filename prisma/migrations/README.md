# Database Migration Strategy

## Overview
This document outlines the migration strategy for the NextJS Stripe Payment Template database schema, designed for PostgreSQL with Canadian compliance requirements.

## Migration Approach

### 1. Initial Migration (0001_init)
- Create all base tables with proper relationships
- Set up indexes for performance optimization
- Configure constraints and foreign keys
- Initialize enums for Canadian provinces and business logic

### 2. Seed Data Migration (0002_seed)
- Insert Canadian tax rates for all provinces
- Create default system settings
- Add sample product categories
- Set up initial admin user (production-safe)

### 3. Future Migrations
- Follow semantic versioning for schema changes
- Always include rollback procedures
- Test migrations on staging environment first
- Document breaking changes thoroughly

## Migration Commands

### Development Environment
```bash
# Generate migration from schema changes
npx prisma migrate dev --name descriptive_migration_name

# Reset database (DANGER: Only in development)
npx prisma migrate reset

# Apply pending migrations
npx prisma migrate dev
```

### Production Environment
```bash
# Deploy migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Generate Prisma Client
npx prisma generate
```

## Pre-Migration Checklist

### Before Running Migrations
- [ ] Backup production database
- [ ] Test migration on staging environment
- [ ] Verify all environment variables are set
- [ ] Check disk space for large migrations
- [ ] Schedule maintenance window if needed
- [ ] Notify team of deployment

### Migration Safety Rules
1. **Never drop columns** in production without proper deprecation period
2. **Always add columns as nullable** first, then make required in separate migration
3. **Use transactions** for multi-step data migrations
4. **Test rollback procedures** before production deployment
5. **Monitor performance** impact of new indexes

## Rollback Strategy

### Manual Rollback Procedure
```sql
-- Example rollback for adding a new column
ALTER TABLE products DROP COLUMN IF EXISTS new_column;

-- Example rollback for index changes
DROP INDEX IF EXISTS idx_products_new_column;
```

### Prisma Rollback (Limited Support)
```bash
# Introspect current database to generate schema
npx prisma db pull

# Reset to specific migration (development only)
npx prisma migrate reset --skip-seed
```

## Migration Best Practices

### Schema Changes
- Use descriptive column names following camelCase convention
- Always include appropriate indexes for foreign keys
- Add comments for complex business logic constraints
- Use appropriate data types for financial data (Int for cents)

### Data Migrations
- Process large datasets in batches
- Use proper error handling and logging
- Validate data integrity after migration
- Keep audit trail of data changes

### Performance Considerations
- Create indexes concurrently in production: `CREATE INDEX CONCURRENTLY`
- Monitor query performance after migrations
- Use EXPLAIN ANALYZE to verify index usage
- Consider partitioning for large tables (orders, audit_logs)

## Environment-Specific Configurations

### Development
```env
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/stripe_template_dev"
```

### Staging  
```env
DATABASE_URL="postgresql://staging_user:staging_password@staging-db:5432/stripe_template_staging"
```

### Production
```env
DATABASE_URL="postgresql://prod_user:secure_password@prod-db:5432/stripe_template_prod"
```

## Monitoring and Alerts

### Key Metrics to Monitor
- Migration execution time
- Database size growth
- Query performance degradation
- Lock conflicts during migration
- Connection pool exhaustion

### Alert Thresholds
- Migration time > 10 minutes
- Database growth > 20% in single migration
- Query response time increase > 50%
- Connection pool utilization > 80%

## Canadian Compliance Considerations

### Tax Rate Updates
- Quarterly review of provincial tax rates
- Automated validation of tax calculations
- Audit trail for all tax rate changes
- Regional compliance reporting

### Data Retention
- Order data: 7 years (CRA requirement)
- Payment data: 6 years minimum
- Audit logs: 7 years for compliance
- Customer data: As per PIPEDA requirements

### Security Requirements
- Encrypt sensitive PII data at column level
- Hash all passwords using bcrypt
- Implement row-level security for multi-tenant features
- Regular security audits of database access