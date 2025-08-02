# Database Schema Design - NextJS Stripe Payment Template

## Executive Summary

This document provides a comprehensive overview of the database schema designed for the NextJS Stripe Payment Template. The schema is optimized for Canadian e-commerce requirements, ensuring compliance with PIPEDA, PCI DSS standards, and CRA regulations while delivering excellent performance at scale.

## Schema Overview

### Core Statistics
- **Total Models**: 25+ comprehensive data models
- **Primary Focus**: Canadian e-commerce with Stripe integration
- **Compliance**: PIPEDA, PCI DSS, CRA requirements
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Performance**: Optimized indexes for sub-second queries

### Key Features
- ✅ Complete Stripe payment integration (payments, subscriptions, invoices)
- ✅ Role-based access control (Admin, Customer, Support)
- ✅ Canadian tax compliance (GST/HST/PST by province)
- ✅ Comprehensive audit logging for compliance
- ✅ Digital product downloads with access control
- ✅ Order management and fulfillment tracking
- ✅ Customer support ticketing system
- ✅ Product catalog with variants and categories
- ✅ Promo codes and discount management
- ✅ Analytics and reporting data structures

## Schema Architecture

### 1. User Management Layer
```
User (Core user accounts)
├── Session (Authentication sessions)
├── Address (Canadian address with province validation)
└── Role-based permissions (Admin/Customer/Support)
```

**Key Features:**
- Secure password hashing with bcrypt
- Multi-factor authentication support
- Canadian province validation
- Email verification workflow
- Session management with Redis

### 2. Product Catalog Layer
```
Category (Hierarchical categories)
├── Product (Main product information)
│   ├── ProductVariant (Size, color, flavor variations)
│   ├── ProductImage (Multiple images per product)
│   └── BundleItem (Product bundling)
└── SubscriptionPlan (Monthly/yearly subscription plans)
```

**Key Features:**
- Digital and physical product support
- Hierarchical category structure
- Product variants with inventory tracking
- SEO optimization fields
- Subscription plan management

### 3. Order Processing Layer
```
Order (Main order entity)
├── OrderItem (Individual items in order)
├── Payment (Stripe payment tracking)
├── Refund (Refund processing)
└── Invoice (Subscription invoicing)
```

**Key Features:**
- Complete order lifecycle management
- Stripe payment intent integration
- Automatic tax calculation for Canada
- Refund processing and tracking
- Order status workflow

### 4. Subscription Management Layer
```
Subscription (Stripe subscriptions)
├── SubscriptionPlan (Plan definitions)
└── Invoice (Recurring billing)
```

**Key Features:**
- Monthly and yearly billing cycles
- Trial period support
- Plan upgrades/downgrades
- Automatic renewal handling
- Stripe billing portal integration

### 5. Digital Products Layer
```
Download (Digital product access)
├── Access control (download limits, expiry)
└── Secure file delivery
```

**Key Features:**
- Secure download links with expiration
- Download limit enforcement
- File access tracking
- Digital rights management

### 6. Support System Layer
```
SupportTicket (Customer support)
└── SupportMessage (Ticket conversations)
```

**Key Features:**
- Multi-priority ticket system
- Internal note support
- Assignment to support agents
- Ticket lifecycle management

### 7. Compliance & Analytics Layer
```
AuditLog (Compliance tracking)
├── AnalyticsEvent (User behavior tracking)
├── TaxRate (Canadian tax rates)
└── SystemSetting (Configuration management)
```

**Key Features:**
- Comprehensive audit trail
- Privacy-compliant analytics
- Canadian tax rate management
- System configuration storage

## Canadian Compliance Features

### PIPEDA Compliance
- **Data Minimization**: Only collect necessary personal information
- **Consent Management**: Granular consent tracking
- **Right to Access**: Complete data export functionality
- **Right to Deletion**: Secure data anonymization
- **Data Retention**: Automated cleanup based on legal requirements

### CRA Compliance
- **Financial Records**: 7-year retention for orders and payments
- **Tax Calculation**: Automatic GST/HST/PST calculation by province
- **Audit Trail**: Complete transaction history
- **Business Numbers**: CRA business number storage

### PCI DSS Compliance
- **No Card Storage**: All payment data handled by Stripe
- **Tokenization**: Only store PCI-compliant tokens
- **Access Controls**: Role-based payment data access
- **Audit Logging**: All payment operations logged

## Performance Optimizations

### Indexing Strategy
```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Order analytics
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);

-- Product catalog
CREATE INDEX idx_products_status_featured ON products(status, featured);
CREATE INDEX idx_products_category_status ON products(category_id, status);

-- Payment processing
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status_created ON payments(status, created_at);
```

### Query Optimization
- **Cursor-based Pagination**: Efficient pagination for large datasets
- **Selective Field Loading**: Only load required fields
- **Database Aggregations**: Server-side calculations
- **Read Replicas**: Separate analytics queries from transactional load

### Caching Strategy
- **Redis Integration**: Session and frequently accessed data
- **Application Caching**: React Query for client-side caching
- **Static Generation**: Next.js ISR for product pages
- **Multi-layer Caching**: Browser, CDN, application, and database levels

## Security Implementation

### Data Encryption
```typescript
// Column-level encryption for sensitive PII
const encryptedPhone = encryptSensitiveData(phoneNumber)
const encryptedAddress = encryptSensitiveData(addressLine1)
```

### Access Control
```typescript
// Role-based middleware
const requireRole = (allowedRoles: UserRole[]) => {
  // JWT validation and role checking
  // Comprehensive audit logging
}
```

### Session Security
- **Secure Session Management**: Redis-based sessions with expiration
- **Multi-Factor Authentication**: TOTP-based MFA support
- **Rate Limiting**: Protection against brute force attacks
- **IP Tracking**: Suspicious activity monitoring

## Data Types and Financial Precision

### Financial Data Handling
All monetary values stored as integers (cents) to avoid floating-point precision issues:
```typescript
// Prices stored in cents (CAD)
price: 4999 // Represents $49.99 CAD
totalAmount: 5649 // Represents $56.49 CAD including tax
```

### Canadian Tax Calculation
Precise decimal handling for tax rates:
```sql
-- Tax rates with 4 decimal precision
rate DECIMAL(5,4) -- e.g., 0.1300 for 13% HST
```

## Migration Strategy

### Development Workflow
```bash
# Generate migration from schema changes
npx prisma migrate dev --name descriptive_name

# Apply to database
npx prisma db push

# Generate client
npx prisma generate
```

### Production Deployment
```bash
# Deploy migrations
npx prisma migrate deploy

# Verify deployment
npx prisma migrate status
```

### Rollback Procedures
- **Automated backups** before each migration
- **Rollback scripts** for complex changes
- **Blue-green deployment** for zero-downtime updates

## Monitoring and Maintenance

### Key Metrics
- **Query Performance**: Average response times < 100ms
- **Database Size**: Growth tracking and alerting
- **Connection Pool**: Usage monitoring
- **Index Efficiency**: Regular index usage analysis

### Automated Maintenance
```bash
# Daily tasks
- Session cleanup
- Expired download cleanup
- Statistics updates

# Weekly tasks  
- Full vacuum analyze
- Old audit log cleanup
- Index maintenance

# Monthly tasks
- Comprehensive backup verification
- Performance review
- Compliance audit
```

## Getting Started

### Quick Setup
1. **Prerequisites**: PostgreSQL 15+, Redis 7+, Node.js 18+
2. **Environment**: Copy `.env.example` to `.env.local`
3. **Database**: Run `npx prisma migrate dev`
4. **Seed Data**: Run `npx tsx prisma/seed.ts`
5. **Verification**: Check database with `npx prisma studio`

### Production Deployment
1. **Environment Variables**: Configure production DATABASE_URL
2. **Migrations**: Run `npx prisma migrate deploy`
3. **Seed**: Run production-safe seeding
4. **Monitoring**: Set up database monitoring
5. **Backups**: Configure automated backup schedule

## File Structure

```
/
├── schema.prisma                     # Main Prisma schema
├── prisma/
│   ├── seed.ts                      # Database seeding script
│   ├── migrations/                  # Migration history
│   └── package.json                 # Prisma dependencies
├── docs/
│   ├── database-performance-optimization.md
│   ├── data-privacy-security.md     # Security documentation
│   └── README_DATABASE_SCHEMA.md    # This file
├── DATABASE_SETUP.md               # Setup instructions
└── .env.example                    # Environment template
```

## Support and Resources

### Documentation
- **Setup Guide**: `DATABASE_SETUP.md`
- **Performance Guide**: `docs/database-performance-optimization.md`
- **Security Guide**: `docs/data-privacy-security.md`

### Key Resources
- **Prisma Documentation**: https://www.prisma.io/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs
- **Stripe API Reference**: https://stripe.com/docs/api
- **Canadian Tax Information**: https://www.canada.ca/en/revenue-agency

This database schema provides a solid foundation for building scalable, compliant, and performant e-commerce applications in the Canadian market. The design balances developer productivity with enterprise-grade requirements, ensuring your application can grow from startup to scale.