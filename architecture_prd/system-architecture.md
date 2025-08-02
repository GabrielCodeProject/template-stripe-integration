# NextJS Stripe Payment Template - System Architecture

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  NextJS Frontend (React 18+)                                   │
│  ├── Shadcn UI Components                                      │
│  ├── TailwindCSS Styling                                       │
│  ├── React Query (State Management)                            │
│  └── BetterAuth Client SDK                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  NextJS API Routes                                              │
│  ├── Authentication Middleware                                 │
│  ├── Rate Limiting Middleware                                  │
│  ├── CORS Configuration                                        │
│  └── Error Handling                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼──────────────┐
                ▼               ▼              ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   AUTH SERVICE  │  │  PAYMENT SERVICE │  │  PRODUCT SERVICE │
│                 │  │                 │  │                 │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ BetterAuth  │ │  │ │   Stripe    │ │  │ │   Product   │ │
│ │   Server    │ │  │ │Integration  │ │  │ │ Management  │ │
│ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │
│                 │  │                 │  │                 │
│ • JWT Tokens    │  │ • Payment Intents│ │ • CRUD Operations│
│ • Role-based    │  │ • Subscriptions │  │ • File Upload   │
│ • Session Mgmt  │  │ • Webhooks      │  │ • SEO Metadata  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database (Primary)                                 │
│  ├── Prisma ORM                                               │
│  ├── Connection Pooling                                       │
│  ├── Read Replicas (Production)                               │
│  └── Automated Backups                                        │
│                                                                │
│  Redis Cache (Session & Performance)                          │
│  ├── Session Storage                                          │
│  ├── Rate Limit Counters                                      │
│  └── Analytics Cache                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                        │
├─────────────────────────────────────────────────────────────────┤
│  Stripe Ecosystem                                              │
│  ├── Payment Processing                                        │
│  ├── Billing Portal                                           │
│  ├── Webhook Events                                            │
│  ├── Tax Calculation                                           │
│  └── Analytics API                                             │
│                                                                │
│  File Storage (Production)                                     │
│  ├── Digital Product Storage                                   │
│  ├── CDN Distribution                                          │
│  └── Secure Download Links                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Component Architecture

### 2.1 Frontend Components Hierarchy

```
src/
├── app/                        # NextJS App Router
│   ├── (auth)/                # Auth route group
│   │   ├── login/
│   │   ├── register/
│   │   └── reset-password/
│   ├── (dashboard)/           # Dashboard route group
│   │   ├── admin/
│   │   │   ├── analytics/
│   │   │   ├── products/
│   │   │   ├── customers/
│   │   │   └── settings/
│   │   ├── customer/
│   │   │   ├── orders/
│   │   │   ├── subscriptions/
│   │   │   └── downloads/
│   │   └── support/
│   ├── (public)/              # Public route group
│   │   ├── products/
│   │   ├── checkout/
│   │   └── success/
│   └── api/                   # API Routes
│       ├── auth/
│       ├── stripe/
│       ├── products/
│       └── admin/
├── components/                # Reusable Components
│   ├── ui/                   # Shadcn UI Components
│   ├── auth/                 # Authentication Components
│   ├── payments/             # Payment Components
│   ├── products/             # Product Components
│   ├── admin/                # Admin Dashboard Components
│   └── layout/               # Layout Components
├── lib/                      # Utility Libraries
│   ├── auth.ts              # BetterAuth Configuration
│   ├── stripe.ts            # Stripe Client
│   ├── prisma.ts            # Database Client
│   ├── validators.ts        # Zod Schemas
│   └── utils.ts             # Helper Functions
└── types/                   # TypeScript Definitions
    ├── auth.ts
    ├── stripe.ts
    └── database.ts
```

### 2.2 Core Service Components

#### Authentication Service
- **Responsibility**: User authentication, authorization, session management
- **Technology**: BetterAuth with JWT tokens
- **Features**:
  - Multi-provider authentication
  - Role-based access control (Admin, Customer, Support)
  - Session persistence
  - Password policies
  - Account lockout protection

#### Payment Service
- **Responsibility**: All payment-related operations
- **Technology**: Stripe API integration
- **Features**:
  - Payment intent creation
  - Subscription management
  - Webhook processing
  - Tax calculation
  - Refund processing

#### Product Service
- **Responsibility**: Product catalog management
- **Technology**: Prisma ORM with PostgreSQL
- **Features**:
  - CRUD operations
  - File upload handling
  - SEO metadata management
  - Inventory tracking
  - Category management

#### Analytics Service
- **Responsibility**: Business intelligence and reporting
- **Technology**: PostgreSQL aggregations + Stripe Analytics API
- **Features**:
  - Revenue tracking
  - Customer metrics
  - Subscription analytics
  - Performance monitoring

## 3. Database Architecture

### 3.1 Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      User       │────▶│   UserRole      │◀────│      Role       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ userId          │     │ id              │
│ email           │     │ roleId          │     │ name            │
│ hashedPassword  │     │ createdAt       │     │ permissions     │
│ stripeCustomerId│     └─────────────────┘     │ createdAt       │
│ emailVerified   │                             └─────────────────┘
│ createdAt       │
│ updatedAt       │
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Order       │────▶│   OrderItem     │◀────│    Product      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ userId          │     │ orderId         │     │ name            │
│ stripePaymentId │     │ productId       │     │ description     │
│ status          │     │ quantity        │     │ price           │
│ totalAmount     │     │ priceAtTime     │     │ stripeProductId │
│ currency        │     │ createdAt       │     │ category        │
│ createdAt       │     └─────────────────┘     │ isActive        │
│ updatedAt       │                             │ downloadUrl     │
└─────────────────┘                             │ createdAt       │
         │                                      │ updatedAt       │
         ▼                                      └─────────────────┘
┌─────────────────┐
│  Subscription   │
├─────────────────┤
│ id              │
│ userId          │
│ stripeSubId     │
│ status          │
│ currentPeriodEnd│
│ cancelAtPeriodEnd│
│ createdAt       │
│ updatedAt       │
└─────────────────┘
```

### 3.2 Database Schema Considerations

1. **ACID Compliance**: PostgreSQL ensures transaction integrity
2. **Indexing Strategy**:
   - Primary keys (clustered)
   - Foreign keys
   - Email lookups
   - Stripe ID lookups
   - Order date ranges
3. **Audit Logging**: Separate audit table for compliance
4. **Data Encryption**: Sensitive fields encrypted at rest
5. **Backup Strategy**: Daily automated backups with point-in-time recovery

## 4. API Architecture

### 4.1 RESTful API Design

```
Authentication Endpoints:
POST   /api/auth/login           # User login
POST   /api/auth/register        # User registration
POST   /api/auth/logout          # User logout
GET    /api/auth/session         # Get current session
POST   /api/auth/refresh         # Refresh JWT token

Product Endpoints:
GET    /api/products             # List products (public)
GET    /api/products/:id         # Get product details
POST   /api/products             # Create product (admin)
PUT    /api/products/:id         # Update product (admin)
DELETE /api/products/:id         # Delete product (admin)

Payment Endpoints:
POST   /api/payments/intent      # Create payment intent
POST   /api/payments/confirm     # Confirm payment
GET    /api/payments/status/:id  # Check payment status
POST   /api/payments/refund      # Process refund (admin/support)

Subscription Endpoints:
GET    /api/subscriptions        # List user subscriptions
POST   /api/subscriptions        # Create subscription
PUT    /api/subscriptions/:id    # Update subscription
DELETE /api/subscriptions/:id    # Cancel subscription
GET    /api/subscriptions/portal # Get billing portal URL

Stripe Webhooks:
POST   /api/webhooks/stripe      # Stripe webhook handler

Admin Endpoints:
GET    /api/admin/analytics      # Analytics data
GET    /api/admin/customers      # Customer management
GET    /api/admin/orders         # Order management
POST   /api/admin/promo-codes    # Create promo codes
```

### 4.2 API Security & Middleware

1. **Authentication Middleware**: JWT validation on protected routes
2. **Rate Limiting**: Per-IP and per-user limits
3. **CORS Configuration**: Restricted origins in production
4. **Input Validation**: Zod schema validation
5. **Error Handling**: Consistent error response format
6. **Logging**: Comprehensive request/response logging

## 5. Security Architecture

### 5.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      PERIMETER SECURITY                        │
├─────────────────────────────────────────────────────────────────┤
│ • SSL/TLS Termination                                          │
│ • DDoS Protection                                              │
│ • WAF (Web Application Firewall)                               │
│ • Rate Limiting                                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION SECURITY                        │
├─────────────────────────────────────────────────────────────────┤
│ • JWT Token Validation                                         │
│ • Role-Based Access Control                                    │
│ • Input Sanitization                                           │
│ • CSRF Protection                                              │
│ • XSS Prevention                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA SECURITY                            │
├─────────────────────────────────────────────────────────────────┤
│ • Encryption at Rest                                           │
│ • Encryption in Transit                                        │
│ • Database Access Controls                                     │
│ • Sensitive Data Masking                                       │
│ • Audit Logging                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 PCI DSS Compliance Strategy

1. **Stripe Tokenization**: No card data stored locally
2. **Secure Transmission**: All payment data via HTTPS
3. **Access Control**: Minimal access to payment systems
4. **Monitoring**: Payment transaction logging
5. **Vulnerability Management**: Regular security updates

## 6. Integration Architecture

### 6.1 Stripe Integration Flow

```
User Action → NextJS Frontend → API Route → Stripe API → Webhook → Database Update

Payment Flow:
1. Customer initiates checkout
2. Frontend creates PaymentIntent via API
3. Stripe Elements collects payment details
4. Payment confirmed with Stripe
5. Webhook updates order status
6. Customer receives confirmation

Subscription Flow:
1. Customer selects subscription plan
2. Stripe Checkout Session created
3. Customer completes payment setup
4. Stripe creates subscription
5. Webhook creates local subscription record
6. Customer gains access to subscription features
```

### 6.2 Canadian Tax Integration

1. **Tax Calculation**: Stripe Tax API for GST/HST/PST
2. **Province Detection**: Based on billing address
3. **Tax Rates**: Automatically updated via Stripe
4. **Compliance**: Proper tax reporting and remittance

## 7. Deployment Architecture

### 7.1 Leaseweb Deployment Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        LEASEWEB CLOUD                          │
├─────────────────────────────────────────────────────────────────┤
│  Load Balancer (Nginx)                                         │
│  ├── SSL Termination                                           │
│  ├── Rate Limiting                                             │
│  └── Static Asset Caching                                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION TIER                          │
├─────────────────────────────────────────────────────────────────┤
│  Docker Container (NextJS App)                                 │
│  ├── Node.js Runtime                                          │
│  ├── PM2 Process Manager                                       │
│  ├── Health Check Endpoints                                    │
│  └── Graceful Shutdown Handling                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA TIER                               │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Primary)          │  Redis (Cache)               │
│  ├── Connection Pooling        │  ├── Session Storage         │
│  ├── Automated Backups         │  ├── Rate Limit Counters     │
│  ├── Read Replicas             │  └── Analytics Cache         │
│  └── Monitoring                │                              │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Docker Configuration

```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS base
FROM base AS deps
FROM base AS builder
FROM base AS runner

# Production optimizations:
# - Multi-stage builds
# - Non-root user
# - Minimal attack surface
# - Health checks
# - Graceful shutdowns
```

### 7.3 CI/CD Pipeline

```yaml
# GitHub Actions Workflow
name: Deploy to Leaseweb
on:
  push:
    branches: [main]

jobs:
  test:
    - Unit tests
    - Integration tests
    - Security scans
    - Code quality checks
  
  build:
    - Build Docker image
    - Push to registry
    - Security scanning
  
  deploy:
    - Deploy to staging
    - Run smoke tests
    - Deploy to production
    - Health checks
```

## 8. Performance Architecture

### 8.1 Caching Strategy

1. **Redis Caching**:
   - Session data (TTL: 24 hours)
   - Rate limit counters (TTL: 1 hour)
   - Analytics data (TTL: 15 minutes)
   - Product catalog (TTL: 30 minutes)

2. **NextJS Caching**:
   - Static pages (ISR: 60 seconds)
   - API responses (stale-while-revalidate)
   - Image optimization (automatic)

3. **Database Optimization**:
   - Query optimization
   - Proper indexing
   - Connection pooling
   - Read replicas for analytics

### 8.2 Monitoring & Observability

1. **Application Monitoring**:
   - Response times
   - Error rates
   - Throughput metrics
   - Memory/CPU usage

2. **Business Metrics**:
   - Payment success rates
   - Subscription conversions
   - Revenue tracking
   - Customer acquisition

3. **Infrastructure Monitoring**:
   - Server health
   - Database performance
   - Cache hit rates
   - External service status

## 9. Technology Stack Recommendations

### 9.1 Core Stack
- **Runtime**: Node.js 18+ LTS
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: Shadcn UI + TailwindCSS
- **Authentication**: BetterAuth
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5+
- **Cache**: Redis 7+
- **Payments**: Stripe API

### 9.2 Development Tools
- **TypeScript**: Full type safety
- **ESLint + Prettier**: Code quality
- **Husky**: Git hooks
- **Jest + Testing Library**: Unit testing
- **Playwright**: E2E testing
- **Docker**: Containerization

### 9.3 Production Services
- **Hosting**: Leaseweb Cloud
- **CDN**: CloudFlare (recommended)
- **Monitoring**: Uptime monitoring service
- **Error Tracking**: Sentry (optional)
- **Analytics**: Built-in + Google Analytics

This architecture provides a solid foundation for building a scalable, secure, and maintainable NextJS Stripe payment template that meets all the requirements outlined in the PRD.