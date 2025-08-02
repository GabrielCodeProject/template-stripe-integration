# Comprehensive Payment Flow Plans
## NextJS Stripe Payment Template

This document outlines the complete payment processing architecture for the NextJS Stripe Payment Template, designed for Canadian SaaS and e-commerce businesses.

---

## Table of Contents

1. [Payment Flow Architecture](#payment-flow-architecture)
2. [One-Time Purchase Flow](#one-time-purchase-flow)
3. [Subscription Payment Flow](#subscription-payment-flow)
4. [Canadian Tax Calculation](#canadian-tax-calculation)
5. [Failed Payment Recovery](#failed-payment-recovery)
6. [Refund and Cancellation Flows](#refund-and-cancellation-flows)
7. [Webhook Event Handling](#webhook-event-handling)
8. [Security and Compliance](#security-and-compliance)
9. [Error Handling Strategies](#error-handling-strategies)
10. [Testing and Validation](#testing-and-validation)

---

## Payment Flow Architecture

### Core Components

```mermaid
graph TB
    A[Customer] --> B[Product Catalog]
    B --> C[Shopping Cart]
    C --> D[Checkout Process]
    D --> E[Tax Calculation]
    E --> F[Stripe Payment]
    F --> G[Payment Processing]
    G --> H[Webhook Handler]
    H --> I[Order Fulfillment]
    I --> J[Digital Delivery]
    
    K[Admin Dashboard] --> L[Analytics]
    K --> M[Order Management]
    K --> N[Subscription Management]
    
    G --> O[Failed Payment]
    O --> P[Recovery Process]
    P --> Q[Dunning Management]
```

### System Dependencies
- **Frontend**: NextJS with Shadcn UI components
- **Backend**: NextJS API routes with Prisma ORM
- **Database**: PostgreSQL with comprehensive audit logging
- **Payment Processor**: Stripe with webhook integration
- **Currency**: CAD (Canadian Dollar) primary support
- **Tax System**: Canadian GST/HST/PST compliance

---

## One-Time Purchase Flow

### Flow Diagram

```mermaid
sequenceDiagram
    participant C as Customer
    participant UI as NextJS Frontend
    participant API as API Routes
    participant DB as Database
    participant S as Stripe
    participant WH as Webhook Handler
    
    C->>UI: Browse Products
    UI->>API: GET /api/products
    API->>DB: Query products
    DB-->>API: Product data
    API-->>UI: Products with pricing
    
    C->>UI: Add to Cart
    UI->>UI: Update cart state
    
    C->>UI: Proceed to Checkout
    UI->>API: POST /api/checkout/validate
    API->>DB: Validate products/inventory
    API->>API: Calculate taxes (Canadian)
    API-->>UI: Validation & tax info
    
    C->>UI: Enter payment details
    UI->>S: Create Payment Method
    S-->>UI: Payment Method ID
    
    UI->>API: POST /api/payments/create-intent
    API->>DB: Create pending order
    API->>S: Create Payment Intent
    S-->>API: Payment Intent
    API-->>UI: Client secret
    
    UI->>S: Confirm Payment
    S->>WH: payment_intent.succeeded
    WH->>DB: Update order status
    WH->>WH: Send confirmation email
    WH->>WH: Process digital delivery
    
    S-->>UI: Payment confirmed
    UI-->>C: Success page + download links
```

### Key Implementation Points

1. **Cart Validation**: Always validate cart contents before payment
2. **Tax Calculation**: Real-time Canadian tax calculation based on customer province
3. **Inventory Check**: For limited digital products, check availability
4. **Payment Intent**: Use Stripe Payment Intents for SCA compliance
5. **Webhook Reliability**: Implement idempotent webhook handlers
6. **Digital Delivery**: Immediate access to digital products post-payment

### Database Updates

```sql
-- Order creation workflow
INSERT INTO orders (
    user_id, order_number, status, subtotal, 
    tax_amount, total_amount, customer_email,
    tax_breakdown, created_at
) VALUES (...);

INSERT INTO order_items (
    order_id, product_id, quantity, unit_price, 
    total_price, name, sku
) VALUES (...);

-- Payment tracking
INSERT INTO payments (
    order_id, stripe_payment_intent_id, status,
    amount, currency, created_at
) VALUES (...);
```

---

## Subscription Payment Flow

### Flow Diagram

```mermaid
sequenceDiagram
    participant C as Customer
    participant UI as NextJS Frontend
    participant API as API Routes
    participant DB as Database
    participant S as Stripe
    participant WH as Webhook Handler
    
    C->>UI: Select Subscription Plan
    UI->>API: GET /api/subscriptions/plans
    API->>DB: Query subscription plans
    DB-->>API: Plans with pricing
    API-->>UI: Available plans
    
    C->>UI: Choose plan & billing cycle
    UI->>API: POST /api/customers/create
    API->>S: Create/Update Customer
    S-->>API: Customer ID
    API->>DB: Store stripe_customer_id
    
    C->>UI: Enter payment method
    UI->>S: Setup Intent for payment method
    S-->>UI: Setup Intent client secret
    UI->>S: Confirm Setup Intent
    S-->>UI: Payment Method attached
    
    UI->>API: POST /api/subscriptions/create
    API->>S: Create Subscription
    S->>WH: customer.subscription.created
    WH->>DB: Create subscription record
    WH->>WH: Send welcome email
    
    S-->>API: Subscription created
    API-->>UI: Success response
    UI-->>C: Welcome page + access
    
    Note over S,WH: Recurring billing cycle
    S->>WH: invoice.payment_succeeded
    WH->>DB: Update subscription status
    WH->>WH: Send receipt email
    
    S->>WH: invoice.payment_failed
    WH->>DB: Mark as past_due
    WH->>WH: Start dunning process
```

### Subscription Management Features

1. **Plan Selection**: Monthly/Yearly with discount incentives
2. **Trial Periods**: Free trial with automatic conversion
3. **Proration**: Automatic calculation for plan changes
4. **Billing Portal**: Stripe-hosted customer portal integration
5. **Dunning Management**: Failed payment recovery workflows

### Database Schema Updates

```sql
-- Subscription creation
INSERT INTO subscriptions (
    user_id, plan_id, stripe_subscription_id,
    stripe_customer_id, status, current_period_start,
    current_period_end, price, created_at
) VALUES (...);

-- Track subscription changes
INSERT INTO audit_logs (
    user_id, action, resource, resource_id,
    old_values, new_values, created_at
) VALUES (...);
```

---

## Canadian Tax Calculation

### Tax Rate Structure

```typescript
interface CanadianTaxRates {
  province: CanadianProvince;
  gst: number;      // Federal GST
  pst?: number;     // Provincial PST
  hst?: number;     // Harmonized HST
  qst?: number;     // Quebec QST
}

const TAX_RATES: Record<CanadianProvince, CanadianTaxRates> = {
  AB: { province: 'AB', gst: 0.05 },
  BC: { province: 'BC', gst: 0.05, pst: 0.07 },
  MB: { province: 'MB', gst: 0.05, pst: 0.07 },
  NB: { province: 'NB', hst: 0.15 },
  NL: { province: 'NL', hst: 0.15 },
  NS: { province: 'NS', hst: 0.15 },
  ON: { province: 'ON', hst: 0.13 },
  PE: { province: 'PE', hst: 0.15 },
  QC: { province: 'QC', gst: 0.05, qst: 0.09975 },
  SK: { province: 'SK', gst: 0.05, pst: 0.06 },
  NT: { province: 'NT', gst: 0.05 },
  NU: { province: 'NU', gst: 0.05 },
  YT: { province: 'YT', gst: 0.05 }
};
```

### Tax Calculation Flow

```mermaid
flowchart TD
    A[Calculate Taxes] --> B{Customer Address?}
    B -->|Yes| C[Get Province]
    B -->|No| D[Use Default ON]
    
    C --> E[Lookup Tax Rates]
    D --> E
    
    E --> F{HST Province?}
    F -->|Yes| G[Apply HST Only]
    F -->|No| H{Quebec?}
    
    H -->|Yes| I[Apply GST + QST]
    H -->|No| J[Apply GST + PST]
    
    G --> K[Calculate Total]
    I --> K
    J --> K
    
    K --> L[Store Tax Breakdown]
    L --> M[Return Tax Amount]
```

### Implementation

```typescript
export function calculateCanadianTax(
  subtotal: number,
  province: CanadianProvince
): TaxCalculation {
  const rates = TAX_RATES[province];
  const breakdown: TaxBreakdown = {};
  let totalTax = 0;

  if (rates.hst) {
    // HST provinces (NB, NL, NS, ON, PE)
    const hstAmount = Math.round(subtotal * rates.hst);
    breakdown.hst = { rate: rates.hst, amount: hstAmount };
    totalTax += hstAmount;
  } else {
    // GST applies to all provinces
    const gstAmount = Math.round(subtotal * rates.gst);
    breakdown.gst = { rate: rates.gst, amount: gstAmount };
    totalTax += gstAmount;

    // Additional provincial taxes
    if (rates.pst) {
      const pstAmount = Math.round(subtotal * rates.pst);
      breakdown.pst = { rate: rates.pst, amount: pstAmount };
      totalTax += pstAmount;
    }

    if (rates.qst) {
      const qstAmount = Math.round(subtotal * rates.qst);
      breakdown.qst = { rate: rates.qst, amount: qstAmount };
      totalTax += qstAmount;
    }
  }

  return {
    subtotal,
    totalTax,
    total: subtotal + totalTax,
    breakdown
  };
}
```

---

## Failed Payment Recovery

### Dunning Management Flow

```mermaid
graph TD
    A[Payment Failed] --> B[Update Status: past_due]
    B --> C[Send Immediate Notification]
    C --> D[Wait 3 Days]
    D --> E[Retry Payment #1]
    E --> F{Success?}
    
    F -->|Yes| G[Restore Subscription]
    F -->|No| H[Send Reminder Email]
    
    H --> I[Wait 5 Days]
    I --> J[Retry Payment #2]
    J --> K{Success?}
    
    K -->|Yes| G
    K -->|No| L[Send Final Notice]
    
    L --> M[Wait 7 Days]
    M --> N[Final Retry Attempt]
    N --> O{Success?}
    
    O -->|Yes| G
    O -->|No| P[Cancel Subscription]
    P --> Q[Send Cancellation Notice]
    
    G --> R[Send Success Email]
```

### Recovery Implementation Strategy

1. **Immediate Response**: Update subscription status and notify customer
2. **Smart Retry Logic**: Exponential backoff with maximum retry limits
3. **Communication**: Progressive email campaign with clear call-to-action
4. **Payment Method Update**: Easy path for customers to update payment methods
5. **Grace Period**: Maintain service access during initial retry period

### Database Tracking

```typescript
interface FailedPaymentTracking {
  subscriptionId: string;
  paymentIntentId: string;
  failureReason: string;
  attemptCount: number;
  nextRetryDate: Date;
  status: 'retrying' | 'succeeded' | 'abandoned';
  lastAttemptDate: Date;
}
```

---

## Refund and Cancellation Flows

### Refund Process Flow

```mermaid
sequenceDiagram
    participant A as Admin/Customer
    participant UI as Admin Dashboard
    participant API as API Routes
    participant DB as Database
    participant S as Stripe
    participant WH as Webhook Handler
    
    A->>UI: Request Refund
    UI->>API: POST /api/refunds/create
    API->>DB: Validate refund eligibility
    API->>S: Create Refund
    S-->>API: Refund created
    API->>DB: Create refund record
    
    S->>WH: charge.dispute.created (if disputed)
    S->>WH: payment_intent.refunded
    WH->>DB: Update refund status
    WH->>WH: Send refund confirmation
    WH->>WH: Revoke digital access
    
    API-->>UI: Refund processed
    UI-->>A: Confirmation message
```

### Cancellation Types

1. **Immediate Cancellation**: Cancel subscription immediately
2. **End of Period**: Cancel at current period end
3. **Downgrade**: Move to free tier instead of cancelling
4. **Pause**: Temporary suspension with easy reactivation

### Business Rules

```typescript
const REFUND_POLICIES = {
  digitalProducts: {
    window: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    conditions: ['not_downloaded', 'technical_issue'],
    partialRefund: false
  },
  subscriptions: {
    proratedRefund: true,
    minimumUsage: 24 * 60 * 60 * 1000, // 24 hours
    cancelAtPeriodEnd: true
  }
};
```

---

## Webhook Event Handling

### Critical Stripe Events

```typescript
const WEBHOOK_EVENTS = {
  // Payment Events
  'payment_intent.succeeded': handlePaymentSuccess,
  'payment_intent.payment_failed': handlePaymentFailure,
  'payment_intent.requires_action': handleRequiresAction,
  
  // Subscription Events
  'customer.subscription.created': handleSubscriptionCreated,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  
  // Invoice Events
  'invoice.payment_succeeded': handleInvoicePaymentSucceeded,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'invoice.finalized': handleInvoiceFinalized,
  
  // Customer Events
  'customer.created': handleCustomerCreated,
  'customer.updated': handleCustomerUpdated,
  'customer.deleted': handleCustomerDeleted,
  
  // Dispute Events
  'charge.dispute.created': handleDisputeCreated,
  'charge.dispute.updated': handleDisputeUpdated,
  
  // Refund Events
  'charge.refunded': handleChargeRefunded,
  'payment_intent.refunded': handlePaymentIntentRefunded
};
```

### Webhook Security & Reliability

```typescript
export async function handleStripeWebhook(
  req: NextRequest
): Promise<NextResponse> {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  
  let event: Stripe.Event;
  
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }
  
  // Idempotency check
  const existingEvent = await db.webhookEvent.findUnique({
    where: { stripeEventId: event.id }
  });
  
  if (existingEvent) {
    return NextResponse.json({ received: true });
  }
  
  // Process event
  try {
    await processWebhookEvent(event);
    
    // Log successful processing
    await db.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        processed: true,
        createdAt: new Date()
      }
    });
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    
    // Log failed processing for retry
    await db.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        processed: false,
        error: error.message,
        createdAt: new Date()
      }
    });
    
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
```

---

## Security and Compliance

### PCI DSS Compliance

1. **No Card Data Storage**: All payment data handled by Stripe
2. **Secure Transmission**: HTTPS enforcement across all endpoints
3. **Access Controls**: Role-based access to payment information
4. **Audit Logging**: Comprehensive logging of all payment activities
5. **Regular Security Reviews**: Automated security scanning

### Data Protection

```typescript
// Sensitive data encryption
export function encryptSensitiveData(data: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY!);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// PII data handling
export function sanitizeCustomerData(customer: Customer): PublicCustomer {
  return {
    id: customer.id,
    email: maskEmail(customer.email),
    firstName: customer.firstName,
    createdAt: customer.createdAt,
    // Exclude sensitive fields
  };
}
```

### Rate Limiting

```typescript
export const rateLimiter = {
  payment: { requests: 10, window: 60000 }, // 10 requests per minute
  webhook: { requests: 100, window: 60000 }, // 100 webhooks per minute
  api: { requests: 1000, window: 60000 }     // 1000 API calls per minute
};
```

---

## Error Handling Strategies

### Payment Error Classification

```typescript
enum PaymentErrorType {
  CARD_DECLINED = 'card_declined',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  EXPIRED_CARD = 'expired_card',
  INCORRECT_CVC = 'incorrect_cvc',
  PROCESSING_ERROR = 'processing_error',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  NETWORK_ERROR = 'network_error'
}

const ERROR_RECOVERY_STRATEGIES = {
  [PaymentErrorType.CARD_DECLINED]: {
    userMessage: 'Your card was declined. Please try a different payment method.',
    retryable: false,
    suggestedAction: 'UPDATE_PAYMENT_METHOD'
  },
  [PaymentErrorType.INSUFFICIENT_FUNDS]: {
    userMessage: 'Insufficient funds. Please use a different card or add funds.',
    retryable: true,
    retryDelay: 24 * 60 * 60 * 1000, // 24 hours
    suggestedAction: 'RETRY_LATER'
  },
  [PaymentErrorType.AUTHENTICATION_REQUIRED]: {
    userMessage: 'Additional authentication required.',
    retryable: true,
    suggestedAction: 'COMPLETE_AUTHENTICATION'
  }
};
```

### Retry Logic Implementation

```typescript
export async function retryPaymentWithBackoff(
  paymentIntentId: string,
  maxAttempts: number = 3
): Promise<Stripe.PaymentIntent> {
  let attempt = 1;
  
  while (attempt <= maxAttempts) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        return paymentIntent;
      }
      
      if (!isRetryableError(paymentIntent.last_payment_error)) {
        throw new Error('Non-retryable payment error');
      }
      
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Exponential backoff: 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    attempt++;
  }
  
  throw new Error('Max retry attempts reached');
}
```

---

## Testing and Validation

### Test Data Setup

```typescript
export const TEST_PAYMENT_METHODS = {
  VISA_SUCCESS: 'pm_card_visa',
  VISA_DECLINED: 'pm_card_visa_debit_declined',
  MASTERCARD_SUCCESS: 'pm_card_mastercard',
  AMEX_SUCCESS: 'pm_card_amex',
  AUTHENTICATION_REQUIRED: 'pm_card_authenticationRequired',
  INSUFFICIENT_FUNDS: 'pm_card_chargeDeclinedInsufficientFunds'
};

export const TEST_SCENARIOS = [
  {
    name: 'Successful One-time Payment',
    paymentMethod: TEST_PAYMENT_METHODS.VISA_SUCCESS,
    amount: 2999, // $29.99 CAD
    expectedOutcome: 'payment_succeeded'
  },
  {
    name: 'Declined Card',
    paymentMethod: TEST_PAYMENT_METHODS.VISA_DECLINED,
    amount: 2999,
    expectedOutcome: 'payment_failed',
    expectedError: 'card_declined'
  },
  {
    name: 'Authentication Required',
    paymentMethod: TEST_PAYMENT_METHODS.AUTHENTICATION_REQUIRED,
    amount: 2999,
    expectedOutcome: 'requires_action'
  }
];
```

### Automated Test Suite

```typescript
describe('Payment Flow Integration Tests', () => {
  beforeEach(async () => {
    // Set up test database
    await setupTestDatabase();
    // Clear previous test data
    await clearTestData();
  });

  test('One-time purchase flow - Success', async () => {
    const product = await createTestProduct();
    const customer = await createTestCustomer();
    
    // Add to cart
    const cart = await addToCart(customer.id, product.id, 1);
    
    // Calculate taxes
    const taxCalculation = calculateCanadianTax(
      product.price,
      customer.address.province
    );
    
    // Create payment intent
    const paymentIntent = await createPaymentIntent({
      amount: product.price + taxCalculation.totalTax,
      customer: customer.stripeCustomerId,
      paymentMethod: TEST_PAYMENT_METHODS.VISA_SUCCESS
    });
    
    // Confirm payment
    const result = await confirmPayment(paymentIntent.id);
    expect(result.status).toBe('succeeded');
    
    // Verify order creation
    const order = await getOrderByPaymentIntent(paymentIntent.id);
    expect(order.status).toBe('COMPLETED');
    expect(order.totalAmount).toBe(product.price + taxCalculation.totalTax);
  });

  test('Subscription creation flow', async () => {
    const plan = await createTestSubscriptionPlan();
    const customer = await createTestCustomer();
    
    // Create subscription
    const subscription = await createSubscription({
      customerId: customer.stripeCustomerId,
      priceId: plan.stripePriceId,
      paymentMethod: TEST_PAYMENT_METHODS.VISA_SUCCESS
    });
    
    expect(subscription.status).toBe('active');
    
    // Verify database record
    const dbSubscription = await getSubscriptionByStripeId(subscription.id);
    expect(dbSubscription.status).toBe('ACTIVE');
  });

  test('Failed payment recovery', async () => {
    // Create subscription with failing payment method
    const subscription = await createFailingSubscription();
    
    // Simulate webhook for failed payment
    await simulateWebhook('invoice.payment_failed', {
      subscription: subscription.id
    });
    
    // Verify dunning process started
    const dbSubscription = await getSubscription(subscription.id);
    expect(dbSubscription.status).toBe('PAST_DUE');
    
    // Verify email sent
    const notifications = await getNotifications(subscription.customerId);
    expect(notifications).toContainEqual(
      expect.objectContaining({
        type: 'PAYMENT_FAILED'
      })
    );
  });
});
```

### Performance Testing

```typescript
const PERFORMANCE_BENCHMARKS = {
  checkoutPageLoad: 2000,      // 2 seconds
  paymentProcessing: 5000,     // 5 seconds
  webhookProcessing: 1000,     // 1 second
  dashboardLoad: 3000,         // 3 seconds
  taxCalculation: 100          // 100 milliseconds
};

describe('Performance Tests', () => {
  test('Checkout performance under load', async () => {
    const startTime = Date.now();
    
    // Simulate 100 concurrent checkout requests
    const promises = Array(100).fill(null).map(() => 
      simulateCheckoutFlow()
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
  });
});
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/stripe_template

# Application
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=your-encryption-key

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=password

# Canadian Tax API (if using external service)
TAX_API_KEY=your-tax-api-key
```

### Production Considerations

1. **Webhook Endpoints**: Configure production webhook URLs in Stripe
2. **SSL Certificates**: Ensure HTTPS for all payment endpoints
3. **Database Backups**: Automated daily backups for payment data
4. **Monitoring**: Set up alerts for payment failures and webhook issues
5. **Rate Limiting**: Implement rate limiting for payment endpoints
6. **Error Tracking**: Comprehensive error logging and alerting

---

## Conclusion

This comprehensive payment flow documentation provides the foundation for implementing a production-ready NextJS Stripe Payment Template. The flows are designed to handle all edge cases while maintaining compliance with Canadian regulations and PCI DSS requirements.

Key success factors:
- Robust error handling and recovery mechanisms
- Comprehensive webhook event processing
- Canadian tax compliance automation
- Secure handling of sensitive payment data
- Extensive testing coverage for all payment scenarios

The implementation should prioritize security, reliability, and user experience while providing comprehensive administrative tools for business management.