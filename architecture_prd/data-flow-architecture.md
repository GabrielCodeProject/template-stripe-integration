# Data Flow Architecture - NextJS Stripe Payment Template

## 1. Core Data Flows

### 1.1 User Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth API
    participant BA as BetterAuth
    participant DB as Database
    participant R as Redis

    U->>F: Login Request
    F->>A: POST /api/auth/login
    A->>BA: Validate Credentials
    BA->>DB: Query User & Roles
    DB-->>BA: User Data
    BA->>R: Store Session
    BA-->>A: JWT Token + Session
    A-->>F: Auth Response
    F-->>U: Redirect to Dashboard
```

### 1.2 Product Purchase Flow (One-time Payment)

```mermaid
sequenceDiagram
    participant C as Customer
    participant UI as Frontend
    participant API as Payment API
    participant S as Stripe
    participant WH as Webhook Handler
    participant DB as Database
    participant Email as Email Service

    C->>UI: Add to Cart & Checkout
    UI->>API: POST /api/payments/intent
    API->>S: Create PaymentIntent
    S-->>API: PaymentIntent ID
    API-->>UI: Client Secret
    UI->>S: Confirm Payment (Stripe Elements)
    S->>WH: payment_intent.succeeded
    WH->>DB: Create Order Record
    WH->>Email: Send Receipt
    S-->>UI: Payment Success
    UI-->>C: Redirect to Success Page
    
    Note over C,Email: Async: Digital product delivery
    WH->>DB: Update Product Access
    Email->>C: Download Links
```

### 1.3 Subscription Management Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant UI as Frontend
    participant API as Subscription API
    participant S as Stripe
    participant WH as Webhook Handler
    participant DB as Database
    participant Portal as Billing Portal

    C->>UI: Select Subscription Plan
    UI->>API: POST /api/subscriptions
    API->>S: Create Checkout Session
    S-->>API: Session URL
    API-->>UI: Checkout URL
    UI-->>C: Redirect to Stripe Checkout
    C->>S: Complete Payment Setup
    S->>WH: customer.subscription.created
    WH->>DB: Create Subscription Record
    S-->>UI: Success Redirect
    
    Note over C,Portal: Customer manages subscription
    C->>Portal: Access Billing Portal
    Portal->>S: Subscription Changes
    S->>WH: subscription.updated/deleted
    WH->>DB: Update Subscription Status
```

### 1.4 Admin Analytics Data Flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant UI as Admin Dashboard
    participant API as Analytics API
    participant DB as Database
    participant S as Stripe
    participant Cache as Redis

    A->>UI: Access Analytics Dashboard
    UI->>API: GET /api/admin/analytics
    API->>Cache: Check Cached Data
    
    alt Cache Hit
        Cache-->>API: Return Cached Analytics
    else Cache Miss
        API->>DB: Query Order Data
        API->>S: Fetch Stripe Metrics
        DB-->>API: Order Analytics
        S-->>API: Payment Analytics
        API->>Cache: Store Aggregated Data
    end
    
    API-->>UI: Analytics Response
    UI-->>A: Display Dashboard
```

## 2. Payment Processing Flows

### 2.1 Checkout Process Data Flow

```
Customer Cart → Payment Intent → Stripe Elements → Payment Confirmation → Webhook Processing → Order Fulfillment

Detailed Steps:
1. Customer adds products to cart (stored in localStorage/session)
2. Customer proceeds to checkout
3. Frontend creates PaymentIntent via API
4. Stripe Elements securely collects payment details
5. Payment is processed by Stripe
6. Webhook confirms payment success
7. Order is created in database
8. Digital products are made available
9. Confirmation email is sent
10. Customer is redirected to success page
```

### 2.2 Subscription Lifecycle Data Flow

```
Plan Selection → Stripe Checkout → Subscription Creation → Recurring Billing → Status Updates

Key Events:
- customer.subscription.created: Initial subscription setup
- invoice.payment_succeeded: Successful recurring payment
- invoice.payment_failed: Failed payment (dunning management)
- customer.subscription.updated: Plan changes, quantity updates
- customer.subscription.deleted: Cancellation
- customer.subscription.paused: Temporary pause (if enabled)
```

### 2.3 Tax Calculation Flow

```mermaid
flowchart TD
    A[Customer Enters Billing Address] --> B[Extract Province/Territory]
    B --> C[Determine Tax Jurisdiction]
    C --> D[Calculate GST/HST/PST]
    D --> E[Apply to Cart Total]
    E --> F[Display Tax Breakdown]
    F --> G[Include in Payment Intent]
    G --> H[Process Payment with Tax]
    H --> I[Record Tax Details in Order]
    
    style D fill:#e1f5fe
    style I fill:#e8f5e8
```

## 3. User Role-Based Data Access

### 3.1 Role Permission Matrix

```
┌─────────────────┬─────────┬──────────┬──────────┐
│ Resource/Action │  Admin  │ Customer │ Support  │
├─────────────────┼─────────┼──────────┼──────────┤
│ Product CRUD    │   ✅    │    ❌     │    👁️    │
│ Order Management│   ✅    │   Own    │    ✅     │
│ Customer Data   │   ✅    │   Own    │    ✅     │
│ Analytics       │   ✅    │    ❌     │ Limited  │
│ Subscriptions   │   ✅    │   Own    │    ✅     │
│ Refunds         │   ✅    │    ❌     │    ✅     │
│ Promo Codes     │   ✅    │    ❌     │    👁️    │
│ System Settings │   ✅    │    ❌     │    ❌     │
└─────────────────┴─────────┴──────────┴──────────┘

Legend: ✅ Full Access | 👁️ Read Only | ❌ No Access | Own = Own Data Only
```

### 3.2 Data Access Control Flow

```mermaid
flowchart TD
    A[API Request] --> B[Extract JWT Token]
    B --> C[Validate Token]
    C --> D{Token Valid?}
    D -->|No| E[Return 401 Unauthorized]
    D -->|Yes| F[Extract User Role]
    F --> G[Check Resource Permissions]
    G --> H{Permission Granted?}
    H -->|No| I[Return 403 Forbidden]
    H -->|Yes| J[Apply Data Filters]
    J --> K[Execute Query]
    K --> L[Return Filtered Data]
    
    style E fill:#ffebee
    style I fill:#ffebee
    style L fill:#e8f5e8
```

## 4. Webhook Event Processing

### 4.1 Stripe Webhook Handler Flow

```mermaid
sequenceDiagram
    participant S as Stripe
    participant WH as Webhook Handler
    participant V as Validator
    participant P as Processor
    participant DB as Database
    participant Q as Queue
    participant N as Notifications

    S->>WH: POST /api/webhooks/stripe
    WH->>V: Verify Signature
    V-->>WH: Signature Valid
    WH->>P: Process Event
    
    alt Critical Event (payment, subscription)
        P->>DB: Update Immediately
        P->>N: Send Notification
    else Non-Critical Event
        P->>Q: Add to Queue
    end
    
    WH-->>S: 200 OK (Acknowledge)
    
    Note over Q,DB: Background Processing
    Q->>P: Process Queued Events
    P->>DB: Batch Updates
```

### 4.2 Event Processing Priority

```
High Priority (Immediate Processing):
- payment_intent.succeeded
- payment_intent.payment_failed  
- customer.subscription.created
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed

Medium Priority (Queue Processing):
- customer.updated
- payment_method.attached
- setup_intent.succeeded

Low Priority (Batch Processing):
- customer.discount.created
- coupon.created
- product.updated
```

## 5. Caching Strategy and Data Flow

### 5.1 Multi-Layer Caching Architecture

```
Browser Cache (Client-Side)
├── Static Assets (Images, CSS, JS)
├── API Response Cache (SWR/React Query)
└── Page Cache (Next.js)

Application Cache (Server-Side)
├── Redis Session Store
├── Rate Limiting Counters
├── Analytics Data Cache
└── Product Catalog Cache

Database Query Cache
├── Connection Pool
├── Query Result Cache
└── Read Replica Routing
```

### 5.2 Cache Invalidation Flow

```mermaid
flowchart TD
    A[Data Update Event] --> B{Data Type?}
    B -->|Product| C[Invalidate Product Cache]
    B -->|Order| D[Invalidate Analytics Cache]
    B -->|User| E[Invalidate Session Cache]
    B -->|Subscription| F[Invalidate Multiple Caches]
    
    C --> G[Update Product Pages]
    D --> H[Refresh Admin Dashboard]
    E --> I[Force Re-authentication]
    F --> J[Update User Dashboard]
    
    G --> K[Trigger ISR Revalidation]
    H --> K
    I --> K
    J --> K
```

## 6. Error Handling and Data Consistency

### 6.1 Error Recovery Flow

```mermaid
flowchart TD
    A[Operation Failure] --> B{Error Type?}
    B -->|Network| C[Retry with Backoff]
    B -->|Validation| D[Return Error to User]
    B -->|Database| E[Transaction Rollback]
    B -->|Stripe| F[Check Idempotency]
    
    C --> G{Max Retries?}
    G -->|No| H[Wait and Retry]
    G -->|Yes| I[Log Error & Alert]
    
    F --> J[Query Stripe Status]
    J --> K{Already Processed?}
    K -->|Yes| L[Return Success]
    K -->|No| M[Process Request]
    
    style I fill:#ffebee
    style L fill:#e8f5e8
```

### 6.2 Data Consistency Patterns

1. **Eventual Consistency**: Webhook processing ensures eventual consistency between Stripe and local database
2. **Idempotency**: All payment operations use idempotency keys to prevent duplicate processing
3. **Compensating Actions**: Failed operations trigger compensating actions to maintain consistency
4. **Audit Trail**: All critical operations are logged for compliance and debugging

## 7. Real-time Data Updates

### 7.1 Server-Sent Events (SSE) for Admin Dashboard

```mermaid
sequenceDiagram
    participant A as Admin
    participant D as Dashboard
    participant SSE as SSE Endpoint
    participant WH as Webhook Handler
    participant Redis as Redis PubSub

    A->>D: Open Dashboard
    D->>SSE: Establish SSE Connection
    WH->>Redis: Publish Event
    Redis->>SSE: Event Notification
    SSE->>D: Send Real-time Update
    D-->>A: Update UI
```

### 7.2 WebSocket for Customer Notifications

```
Customer Payment Status Updates:
- Payment processing
- Payment confirmed
- Subscription renewed
- Download available
```

## 8. Data Migration and Backup Flows

### 8.1 Database Backup Strategy

```
Daily Automated Backups:
├── Full Database Backup (02:00 UTC)
├── Transaction Log Backup (Every 15 minutes)
├── Point-in-Time Recovery Setup
└── Cross-Region Backup Replication

Backup Verification:
├── Automated Restore Testing (Weekly)
├── Backup Integrity Checks (Daily)
└── Recovery Time Testing (Monthly)
```

### 8.2 Data Migration Flow

```mermaid
flowchart TD
    A[Migration Trigger] --> B[Pre-Migration Backup]
    B --> C[Schema Validation]
    C --> D[Dry Run Migration]
    D --> E{Dry Run Success?}
    E -->|No| F[Fix Issues & Retry]
    E -->|Yes| G[Execute Migration]
    G --> H[Verify Data Integrity]
    H --> I{Verification Pass?}
    I -->|No| J[Rollback to Backup]
    I -->|Yes| K[Update Application]
    K --> L[Monitor Performance]
    
    style F fill:#fff3e0
    style J fill:#ffebee
    style L fill:#e8f5e8
```

This data flow architecture ensures reliable, secure, and performant data processing throughout the NextJS Stripe Payment Template, with proper error handling, caching strategies, and real-time updates where needed.