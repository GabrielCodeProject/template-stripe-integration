# Testing Strategies for Payment Flows
## NextJS Stripe Payment Template

Comprehensive testing strategy covering unit tests, integration tests, end-to-end scenarios, and production monitoring for payment processing systems.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Environment Setup](#test-environment-setup)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Webhook Testing](#webhook-testing)
9. [Canadian Tax Testing](#canadian-tax-testing)
10. [Production Monitoring](#production-monitoring)

---

## Testing Philosophy

### Test Pyramid Structure
```
          /\
         /  \
        / E2E \ (10% - Critical user journeys)
       /______\
      /        \
     /Integration\ (30% - API & service interactions)
    /____________\
   /              \
  /     Unit       \ (60% - Individual functions & components)
 /________________\
```

### Core Principles
1. **Fail Fast**: Tests should catch errors early in development
2. **Deterministic**: Tests should produce consistent results
3. **Isolated**: Each test should be independent
4. **Readable**: Test names and structure should be self-documenting
5. **Maintainable**: Tests should be easy to update as code evolves

---

## Test Environment Setup

### Environment Configuration

```typescript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.config.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};
```

### Test Database Setup

```typescript
// tests/setup.ts
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

let db: PrismaClient;

beforeAll(async () => {
  // Set up test database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  
  // Run migrations
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }
  });
  
  db = new PrismaClient();
});

beforeEach(async () => {
  // Clear all tables before each test
  await clearDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

async function clearDatabase() {
  const tables = [
    'webhook_event',
    'audit_log',
    'notification',
    'download',
    'refund',
    'payment',
    'order_item',
    'order',
    'invoice',
    'subscription',
    'user',
    'product'
  ];
  
  for (const table of tables) {
    await db.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

export { db };
```

### Stripe Test Setup

```typescript
// tests/stripe-test-setup.ts
import Stripe from 'stripe';

export const testStripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export const TEST_PAYMENT_METHODS = {
  VISA_SUCCESS: 'pm_card_visa',
  VISA_DECLINED: 'pm_card_visa_debit_declined',
  MASTERCARD_SUCCESS: 'pm_card_mastercard',
  AMEX_SUCCESS: 'pm_card_amex',
  AUTHENTICATION_REQUIRED: 'pm_card_authenticationRequired',
  INSUFFICIENT_FUNDS: 'pm_card_chargeDeclinedInsufficientFunds',
  GENERIC_DECLINE: 'pm_card_chargeDeclined'
};

export const TEST_CUSTOMERS = {
  VALID_CUSTOMER: {
    email: 'test@example.com',
    name: 'Test Customer',
    address: {
      line1: '123 Test St',
      city: 'Toronto',
      state: 'ON',
      postal_code: 'M5V 3A1',
      country: 'CA'
    }
  }
};

export async function createTestCustomer(): Promise<Stripe.Customer> {
  return await testStripe.customers.create(TEST_CUSTOMERS.VALID_CUSTOMER);
}

export async function createTestProduct(): Promise<Stripe.Product> {
  return await testStripe.products.create({
    name: 'Test Digital Product',
    type: 'good',
    metadata: { type: 'digital' }
  });
}

export async function createTestPrice(productId: string): Promise<Stripe.Price> {
  return await testStripe.prices.create({
    product: productId,
    unit_amount: 2999, // $29.99
    currency: 'cad',
    metadata: { test: 'true' }
  });
}
```

---

## Unit Testing

### Tax Calculation Tests

```typescript
// tests/unit/tax/canadian-tax.test.ts
import { calculateCanadianTax, CANADIAN_TAX_RATES } from '@/lib/tax/canadian-tax';
import { CanadianProvince } from '@prisma/client';

describe('Canadian Tax Calculation', () => {
  describe('calculateCanadianTax', () => {
    test('should calculate HST correctly for Ontario', () => {
      const result = calculateCanadianTax(10000, CanadianProvince.ON);
      
      expect(result.subtotal).toBe(10000);
      expect(result.totalTax).toBe(1300); // 13% HST
      expect(result.total).toBe(11300);
      expect(result.breakdown.hst).toEqual({
        rate: 0.13,
        amount: 1300
      });
    });

    test('should calculate GST + PST correctly for British Columbia', () => {
      const result = calculateCanadianTax(10000, CanadianProvince.BC);
      
      expect(result.subtotal).toBe(10000);
      expect(result.totalTax).toBe(1200); // 5% GST + 7% PST
      expect(result.total).toBe(11200);
      expect(result.breakdown.gst).toEqual({
        rate: 0.05,
        amount: 500
      });
      expect(result.breakdown.pst).toEqual({
        rate: 0.07,
        amount: 700
      });
    });

    test('should calculate GST + QST correctly for Quebec', () => {
      const result = calculateCanadianTax(10000, CanadianProvince.QC);
      
      expect(result.subtotal).toBe(10000);
      // GST: 5% = 500, QST: 9.975% on (subtotal + GST) = 1048
      expect(result.totalTax).toBe(1548);
      expect(result.total).toBe(11548);
      expect(result.breakdown.gst).toEqual({
        rate: 0.05,
        amount: 500
      });
      expect(result.breakdown.qst).toEqual({
        rate: 0.09975,
        amount: 1048
      });
    });

    test('should handle zero amount', () => {
      const result = calculateCanadianTax(0, CanadianProvince.ON);
      
      expect(result.subtotal).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual({});
    });

    test('should throw error for invalid province', () => {
      expect(() => {
        calculateCanadianTax(10000, 'INVALID' as CanadianProvince);
      }).toThrow('Tax rates not found for province: INVALID');
    });
  });

  describe('Tax rate validation', () => {
    test('all provinces should have valid tax rates', () => {
      Object.entries(CANADIAN_TAX_RATES).forEach(([province, rates]) => {
        expect(rates.province).toBe(province);
        expect(rates.effectiveDate).toBeInstanceOf(Date);
        expect(rates.description).toBeTruthy();
        
        // Should have either HST or GST
        if (rates.hst) {
          expect(rates.hst).toBeGreaterThan(0);
          expect(rates.hst).toBeLessThan(0.2); // Reasonable upper bound
        } else {
          expect(rates.gst).toBeGreaterThan(0);
          expect(rates.gst).toBeLessThan(0.1); // GST should be around 5%
        }
      });
    });
  });
});
```

### Payment Error Classification Tests

```typescript
// tests/unit/errors/payment-errors.test.ts
import { 
  classifyStripeError, 
  PaymentErrorType, 
  ERROR_RECOVERY_STRATEGIES 
} from '@/lib/errors/payment-errors';
import Stripe from 'stripe';

describe('Payment Error Classification', () => {
  describe('classifyStripeError', () => {
    test('should classify card declined error correctly', () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'card_declined',
        message: 'Your card was declined.',
        request_id: 'req_123'
      } as Stripe.errors.StripeError;

      const result = classifyStripeError(stripeError);

      expect(result.type).toBe(PaymentErrorType.CARD_DECLINED);
      expect(result.retryable).toBe(false);
      expect(result.severity).toBe('MEDIUM');
      expect(result.suggestedAction).toBe('UPDATE_PAYMENT_METHOD');
    });

    test('should classify insufficient funds error correctly', () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'insufficient_funds',
        message: 'Your card has insufficient funds.',
        request_id: 'req_123'
      } as Stripe.errors.StripeError;

      const result = classifyStripeError(stripeError);

      expect(result.type).toBe(PaymentErrorType.INSUFFICIENT_FUNDS);
      expect(result.retryable).toBe(true);
      expect(result.retryDelay).toBe(86400000); // 24 hours
      expect(result.maxRetries).toBe(3);
    });

    test('should classify network error correctly', () => {
      const stripeError = {
        type: 'StripeConnectionError',
        message: 'Network connection failed.',
        request_id: 'req_123'
      } as Stripe.errors.StripeError;

      const result = classifyStripeError(stripeError);

      expect(result.type).toBe(PaymentErrorType.NETWORK_ERROR);
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe('MEDIUM');
    });
  });

  describe('Error recovery strategies', () => {
    test('all error types should have recovery strategies', () => {
      Object.values(PaymentErrorType).forEach(errorType => {
        const strategy = ERROR_RECOVERY_STRATEGIES[errorType];
        
        expect(strategy).toBeDefined();
        expect(strategy.type).toBe(errorType);
        expect(strategy.userMessage).toBeTruthy();
        expect(strategy.suggestedAction).toBeTruthy();
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(strategy.severity);
      });
    });
  });
});
```

---

## Integration Testing

### Payment Flow Integration Tests

```typescript
// tests/integration/payment-flow.test.ts
import { db } from '../setup';
import { testStripe, createTestCustomer, createTestProduct, createTestPrice } from '../stripe-test-setup';
import { processPaymentIntent } from '@/lib/payments/payment-processor';
import { calculateCanadianTax } from '@/lib/tax/canadian-tax';

describe('Payment Flow Integration', () => {
  let testCustomer: any;
  let testProduct: any;
  let testPrice: any;
  let testUser: any;

  beforeEach(async () => {
    // Set up test data
    testCustomer = await createTestCustomer();
    testProduct = await createTestProduct();
    testPrice = await createTestPrice(testProduct.id);
    
    testUser = await db.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        stripeCustomerId: testCustomer.id,
        address: {
          create: {
            firstName: 'Test',
            lastName: 'User',
            addressLine1: '123 Test St',
            city: 'Toronto',
            province: 'ON',
            postalCode: 'M5V 3A1',
            country: 'CA'
          }
        }
      },
      include: { address: true }
    });
  });

  test('complete one-time payment flow', async () => {
    // Create product in database
    const product = await db.product.create({
      data: {
        name: 'Test Digital Product',
        slug: 'test-digital-product',
        type: 'DIGITAL',
        status: 'ACTIVE',
        price: 2999,
        stripeProductId: testProduct.id,
        stripePriceId: testPrice.id
      }
    });

    // Calculate taxes
    const taxCalculation = calculateCanadianTax(2999, 'ON');
    const totalAmount = 2999 + taxCalculation.totalTax;

    // Create payment intent
    const paymentIntent = await testStripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'cad',
      customer: testCustomer.id,
      payment_method: 'pm_card_visa',
      confirm: true,
      return_url: 'http://localhost:3000/success'
    });

    // Create order in database
    const order = await db.order.create({
      data: {
        userId: testUser.id,
        orderNumber: `TEST-${Date.now()}`,
        stripePaymentIntentId: paymentIntent.id,
        status: 'PENDING',
        subtotal: 2999,
        taxAmount: taxCalculation.totalTax,
        totalAmount: totalAmount,
        customerEmail: testUser.email,
        taxBreakdown: taxCalculation.breakdown,
        items: {
          create: {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: 2999,
            totalPrice: 2999
          }
        }
      }
    });

    // Process payment (simulate webhook)
    if (paymentIntent.status === 'succeeded') {
      await processPaymentIntent(paymentIntent);

      // Verify order was completed
      const updatedOrder = await db.order.findUnique({
        where: { id: order.id },
        include: { payments: true }
      });

      expect(updatedOrder?.status).toBe('COMPLETED');
      expect(updatedOrder?.payments).toHaveLength(1);
      expect(updatedOrder?.payments[0].status).toBe('SUCCEEDED');
    }
  });

  test('failed payment handling', async () => {
    // Create payment intent with declining card
    const paymentIntent = await testStripe.paymentIntents.create({
      amount: 2999,
      currency: 'cad',
      customer: testCustomer.id,
      payment_method: 'pm_card_visa_debit_declined',
      confirm: true,
      return_url: 'http://localhost:3000/failure'
    });

    expect(paymentIntent.status).toBe('requires_payment_method');
    expect(paymentIntent.last_payment_error?.code).toBe('card_declined');
  });
});
```

### Subscription Integration Tests

```typescript
// tests/integration/subscription-flow.test.ts
import { db } from '../setup';
import { testStripe, createTestCustomer } from '../stripe-test-setup';
import { SubscriptionManager } from '@/lib/subscriptions/subscription-manager';

describe('Subscription Flow Integration', () => {
  let subscriptionManager: SubscriptionManager;
  let testUser: any;
  let testCustomer: any;
  let testPlan: any;

  beforeEach(async () => {
    subscriptionManager = new SubscriptionManager(testStripe);
    
    testCustomer = await createTestCustomer();
    
    testUser = await db.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        stripeCustomerId: testCustomer.id
      }
    });

    // Create test subscription plan
    const stripeProduct = await testStripe.products.create({
      name: 'Test Subscription',
      type: 'service'
    });

    const stripePrice = await testStripe.prices.create({
      product: stripeProduct.id,
      unit_amount: 2999,
      currency: 'cad',
      recurring: { interval: 'month' }
    });

    testPlan = await db.subscriptionPlan.create({
      data: {
        name: 'Test Monthly Plan',
        price: 2999,
        billingInterval: 'month',
        stripePriceId: stripePrice.id,
        productId: 'test-product-id'
      }
    });
  });

  test('create subscription successfully', async () => {
    const request = {
      userId: testUser.id,
      planId: testPlan.id,
      paymentMethodId: 'pm_card_visa',
      billingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test St',
        city: 'Toronto',
        province: 'ON' as any,
        postalCode: 'M5V 3A1',
        country: 'CA'
      }
    };

    const result = await subscriptionManager.createSubscription(request);

    expect(result.subscription).toBeDefined();
    expect(result.customer.id).toBe(testCustomer.id);

    // Verify database record
    const dbSubscription = await db.subscription.findFirst({
      where: { userId: testUser.id }
    });

    expect(dbSubscription).toBeDefined();
    expect(dbSubscription?.planId).toBe(testPlan.id);
    expect(dbSubscription?.price).toBe(2999);
  });

  test('cancel subscription at period end', async () => {
    // First create a subscription
    const createRequest = {
      userId: testUser.id,
      planId: testPlan.id,
      paymentMethodId: 'pm_card_visa',
      billingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test St',
        city: 'Toronto',
        province: 'ON' as any,
        postalCode: 'M5V 3A1',
        country: 'CA'
      }
    };

    const createResult = await subscriptionManager.createSubscription(createRequest);

    // Then cancel it
    const cancelRequest = {
      subscriptionId: createResult.subscription.stripeSubscriptionId,
      cancelAtPeriodEnd: true,
      cancellationReason: 'too_expensive',
      feedback: 'Too expensive for current budget'
    };

    const cancelResult = await subscriptionManager.cancelSubscription(cancelRequest);

    expect(cancelResult.subscription.cancelAtPeriodEnd).toBe(true);
    expect(cancelResult.subscription.canceledAt).toBeTruthy();
  });
});
```

---

## End-to-End Testing

### E2E Test Setup with Playwright

```typescript
// tests/e2e/payment-checkout.spec.ts
import { test, expect, Page } from '@playwright/test';

class PaymentPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/products/test-product');
  }

  async addToCart() {
    await this.page.click('[data-testid="add-to-cart"]');
  }

  async proceedToCheckout() {
    await this.page.click('[data-testid="checkout-button"]');
  }

  async fillBillingAddress() {
    await this.page.fill('[data-testid="billing-first-name"]', 'Test');
    await this.page.fill('[data-testid="billing-last-name"]', 'User');
    await this.page.fill('[data-testid="billing-address"]', '123 Test St');
    await this.page.fill('[data-testid="billing-city"]', 'Toronto');
    await this.page.selectOption('[data-testid="billing-province"]', 'ON');
    await this.page.fill('[data-testid="billing-postal-code"]', 'M5V 3A1');
  }

  async enterPaymentMethod() {
    // Switch to Stripe iframe
    const stripeFrame = this.page.frameLocator('iframe[name*="__privateStripeFrame"]');
    await stripeFrame.fill('[name="cardnumber"]', '4242424242424242');
    await stripeFrame.fill('[name="exp-date"]', '12/30');
    await stripeFrame.fill('[name="cvc"]', '123');
  }

  async submitPayment() {
    await this.page.click('[data-testid="submit-payment"]');
  }

  async waitForSuccess() {
    await expect(this.page.locator('[data-testid="payment-success"]')).toBeVisible();
  }

  async waitForError() {
    await expect(this.page.locator('[data-testid="payment-error"]')).toBeVisible();
  }
}

test.describe('Payment Checkout Flow', () => {
  test('successful payment with valid card', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    await paymentPage.goto();
    await paymentPage.addToCart();
    await paymentPage.proceedToCheckout();
    await paymentPage.fillBillingAddress();
    await paymentPage.enterPaymentMethod();
    await paymentPage.submitPayment();
    await paymentPage.waitForSuccess();

    // Verify success page content
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-links"]')).toBeVisible();
  });

  test('failed payment with declined card', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    await paymentPage.goto();
    await paymentPage.addToCart();
    await paymentPage.proceedToCheckout();
    await paymentPage.fillBillingAddress();
    
    // Use declined card number
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
    await stripeFrame.fill('[name="cardnumber"]', '4000000000000002');
    await stripeFrame.fill('[name="exp-date"]', '12/30');
    await stripeFrame.fill('[name="cvc"]', '123');
    
    await paymentPage.submitPayment();
    await paymentPage.waitForError();

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('card was declined');
  });

  test('tax calculation for different provinces', async ({ page }) => {
    await page.goto('/products/test-product');

    // Test Ontario (HST)
    await page.selectOption('[data-testid="province-selector"]', 'ON');
    await expect(page.locator('[data-testid="tax-display"]')).toContainText('HST (13.0%):');

    // Test British Columbia (GST + PST)
    await page.selectOption('[data-testid="province-selector"]', 'BC');
    await expect(page.locator('[data-testid="tax-display"]')).toContainText('GST (5.0%):');
    await expect(page.locator('[data-testid="tax-display"]')).toContainText('PST (7.0%):');

    // Test Quebec (GST + QST)
    await page.selectOption('[data-testid="province-selector"]', 'QC');
    await expect(page.locator('[data-testid="tax-display"]')).toContainText('GST (5.0%):');
    await expect(page.locator('[data-testid="tax-display"]')).toContainText('QST (9.975%):');
  });
});
```

### Subscription E2E Tests

```typescript
// tests/e2e/subscription-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Subscription Management', () => {
  test('create and manage subscription', async ({ page }) => {
    // Navigate to subscription plans
    await page.goto('/pricing');
    
    // Select a plan
    await page.click('[data-testid="select-monthly-plan"]');
    
    // Fill subscription form
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="first-name"]', 'Test');
    await page.fill('[data-testid="last-name"]', 'User');
    
    // Enter payment method
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
    await stripeFrame.fill('[name="cardnumber"]', '4242424242424242');
    await stripeFrame.fill('[name="exp-date"]', '12/30');
    await stripeFrame.fill('[name="cvc"]', '123');
    
    // Submit subscription
    await page.click('[data-testid="create-subscription"]');
    
    // Wait for success
    await expect(page.locator('[data-testid="subscription-success"]')).toBeVisible();
    
    // Navigate to billing portal
    await page.click('[data-testid="manage-billing"]');
    
    // Verify redirect to Stripe billing portal
    await expect(page).toHaveURL(/.*billing\.stripe\.com.*/);
  });

  test('subscription cancellation flow', async ({ page }) => {
    // Assume user is logged in with active subscription
    await page.goto('/account/subscriptions');
    
    // Cancel subscription
    await page.click('[data-testid="cancel-subscription"]');
    
    // Confirm cancellation
    await page.selectOption('[data-testid="cancellation-reason"]', 'too_expensive');
    await page.fill('[data-testid="cancellation-feedback"]', 'Found a cheaper alternative');
    await page.click('[data-testid="confirm-cancellation"]');
    
    // Verify cancellation success
    await expect(page.locator('[data-testid="cancellation-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('Cancelled');
  });
});
```

---

## Performance Testing

### Load Testing Configuration

```typescript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'], // Error rate under 1%
    errors: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Test payment intent creation
  const paymentData = {
    items: [{ productId: 'test-product', quantity: 1 }],
    billingAddress: {
      firstName: 'Test',
      lastName: 'User',
      addressLine1: '123 Test St',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 3A1',
      country: 'CA'
    }
  };

  const paymentResponse = http.post(
    `${BASE_URL}/api/payments/create-intent`,
    JSON.stringify(paymentData),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    }
  );

  check(paymentResponse, {
    'payment intent created': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  // Test tax calculation
  const taxResponse = http.post(
    `${BASE_URL}/api/tax/calculate`,
    JSON.stringify({
      items: [{ productId: 'test-product', quantity: 1, unitPrice: 2999 }],
      province: 'ON'
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  check(taxResponse, {
    'tax calculated': (r) => r.status === 200,
    'tax response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}
```

### Database Performance Tests

```typescript
// tests/performance/database-performance.test.ts
import { db } from '../setup';
import { performance } from 'perf_hooks';

describe('Database Performance', () => {
  test('order queries should complete under 100ms', async () => {
    // Create test data
    const users = await Promise.all(
      Array(100).fill(null).map((_, i) =>
        db.user.create({
          data: {
            email: `user${i}@example.com`,
            firstName: 'Test',
            lastName: 'User'
          }
        })
      )
    );

    const orders = await Promise.all(
      users.map((user, i) =>
        db.order.create({
          data: {
            userId: user.id,
            orderNumber: `ORDER-${i}`,
            status: 'COMPLETED',
            subtotal: 2999,
            totalAmount: 3389,
            customerEmail: user.email
          }
        })
      )
    );

    // Test query performance
    const start = performance.now();
    
    const result = await db.order.findMany({
      where: { status: 'COMPLETED' },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const duration = performance.now() - start;

    expect(result).toHaveLength(20);
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });

  test('user lookup by email should be fast', async () => {
    // Create test users
    await Promise.all(
      Array(1000).fill(null).map((_, i) =>
        db.user.create({
          data: {
            email: `user${i}@example.com`,
            firstName: 'Test',
            lastName: 'User'
          }
        })
      )
    );

    // Test email lookup performance
    const start = performance.now();
    
    const user = await db.user.findUnique({
      where: { email: 'user500@example.com' }
    });

    const duration = performance.now() - start;

    expect(user).toBeTruthy();
    expect(duration).toBeLessThan(10); // Should complete in under 10ms with index
  });
});
```

---

## Security Testing

### Input Validation Tests

```typescript
// tests/security/input-validation.test.ts
import { pciCompliance } from '@/lib/security/pci-compliance';

describe('Security Input Validation', () => {
  describe('sanitizeInput', () => {
    test('should remove script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const sanitized = pciCompliance.sanitizeInput(maliciousInput);
      
      expect(sanitized).toBe('Hello');
      expect(sanitized).not.toContain('<script>');
    });

    test('should remove javascript: protocols', () => {
      const maliciousInput = 'javascript:alert("xss")';
      const sanitized = pciCompliance.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('javascript:');
    });

    test('should handle nested objects', () => {
      const maliciousInput = {
        name: 'Test',
        description: '<script>alert("xss")</script>',
        nested: {
          value: 'javascript:alert("nested")'
        }
      };

      const sanitized = pciCompliance.sanitizeInput(maliciousInput);
      
      expect(sanitized.name).toBe('Test');
      expect(sanitized.description).not.toContain('<script>');
      expect(sanitized.nested.value).not.toContain('javascript:');
    });
  });

  describe('detectSuspiciousActivity', () => {
    test('should detect SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const result = pciCompliance.detectSuspiciousActivity(sqlInjection);
      
      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain(expect.stringContaining('SQL injection'));
    });

    test('should detect XSS attempts', () => {
      const xssAttempt = '<iframe src="javascript:alert(1)"></iframe>';
      const result = pciCompliance.detectSuspiciousActivity(xssAttempt);
      
      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain(expect.stringContaining('XSS'));
    });

    test('should not flag normal input', () => {
      const normalInput = 'This is a normal product description.';
      const result = pciCompliance.detectSuspiciousActivity(normalInput);
      
      expect(result.suspicious).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('maskSensitiveData', () => {
    test('should mask credit card numbers', () => {
      const cardData = 'Card number: 4242424242424242';
      const masked = pciCompliance.maskSensitiveData(cardData);
      
      expect(masked).toContain('4242************');
      expect(masked).not.toContain('4242424242424242');
    });

    test('should mask Stripe keys', () => {
      const keyData = 'Key: sk_test_51abc123def456';
      const masked = pciCompliance.maskSensitiveData(keyData);
      
      expect(masked).toContain('sk_t*************');
      expect(masked).not.toContain('sk_test_51abc123def456');
    });
  });
});
```

### Webhook Security Tests

```typescript
// tests/security/webhook-security.test.ts
import { pciCompliance } from '@/lib/security/pci-compliance';
import crypto from 'crypto';

describe('Webhook Security', () => {
  const webhookSecret = 'whsec_test123';
  const payload = JSON.stringify({ type: 'payment_intent.succeeded' });

  function createStripeSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadForSignature = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadForSignature, 'utf8')
      .digest('hex');
    
    return `t=${timestamp},v1=${signature}`;
  }

  test('should validate correct webhook signature', () => {
    const signature = createStripeSignature(payload, webhookSecret);
    const isValid = pciCompliance.validateWebhookSignature(
      payload,
      signature,
      webhookSecret
    );
    
    expect(isValid).toBe(true);
  });

  test('should reject invalid webhook signature', () => {
    const invalidSignature = 't=1234567890,v1=invalid_signature';
    const isValid = pciCompliance.validateWebhookSignature(
      payload,
      invalidSignature,
      webhookSecret
    );
    
    expect(isValid).toBe(false);
  });

  test('should reject old webhook signatures', () => {
    // Create signature with old timestamp (over 5 minutes ago)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
    const payloadForSignature = `${oldTimestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadForSignature, 'utf8')
      .digest('hex');
    
    const oldSignature = `t=${oldTimestamp},v1=${signature}`;
    const isValid = pciCompliance.validateWebhookSignature(
      payload,
      oldSignature,
      webhookSecret
    );
    
    expect(isValid).toBe(false);
  });
});
```

---

## Webhook Testing

### Webhook Event Simulation

```typescript
// tests/webhooks/webhook-simulation.test.ts
import { processWebhookEvent } from '@/lib/stripe/webhook-handlers';
import { db } from '../setup';
import Stripe from 'stripe';

describe('Webhook Event Processing', () => {
  test('should process payment_intent.succeeded event', async () => {
    // Create test order
    const user = await db.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      }
    });

    const order = await db.order.create({
      data: {
        userId: user.id,
        orderNumber: 'TEST-001',
        stripePaymentIntentId: 'pi_test123',
        status: 'PENDING',
        subtotal: 2999,
        totalAmount: 3389,
        customerEmail: user.email
      }
    });

    // Simulate webhook event
    const webhookEvent: Stripe.Event = {
      id: 'evt_test123',
      object: 'event',
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: 'req_test123', idempotency_key: null },
      api_version: '2023-10-16',
      data: {
        object: {
          id: 'pi_test123',
          object: 'payment_intent',
          amount: 3389,
          currency: 'cad',
          status: 'succeeded',
          latest_charge: 'ch_test123'
        } as any
      }
    };

    // Process webhook
    await processWebhookEvent(webhookEvent);

    // Verify order was updated
    const updatedOrder = await db.order.findUnique({
      where: { id: order.id },
      include: { payments: true }
    });

    expect(updatedOrder?.status).toBe('COMPLETED');
    expect(updatedOrder?.payments).toHaveLength(1);
    expect(updatedOrder?.payments[0].status).toBe('SUCCEEDED');
  });

  test('should handle invoice.payment_failed event', async () => {
    // Create test subscription
    const user = await db.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        stripeCustomerId: 'cus_test123'
      }
    });

    const subscription = await db.subscription.create({
      data: {
        userId: user.id,
        planId: 'plan_test123',
        stripeSubscriptionId: 'sub_test123',
        stripeCustomerId: 'cus_test123',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        price: 2999
      }
    });

    // Simulate failed payment webhook
    const webhookEvent: Stripe.Event = {
      id: 'evt_test456',
      object: 'event',
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: 'req_test456', idempotency_key: null },
      api_version: '2023-10-16',
      data: {
        object: {
          id: 'in_test123',
          object: 'invoice',
          subscription: 'sub_test123',
          amount_due: 2999,
          status: 'open'
        } as any
      }
    };

    // Process webhook
    await processWebhookEvent(webhookEvent);

    // Verify subscription status was updated
    const updatedSubscription = await db.subscription.findUnique({
      where: { id: subscription.id }
    });

    expect(updatedSubscription?.status).toBe('PAST_DUE');
  });
});
```

---

## Canadian Tax Testing

### Provincial Tax Rate Tests

```typescript
// tests/tax/provincial-rates.test.ts
import { 
  calculateCanadianTax, 
  getProvinceTaxInfo,
  getEffectiveTaxRate 
} from '@/lib/tax/canadian-tax';
import { CanadianProvince } from '@prisma/client';

describe('Provincial Tax Rates', () => {
  const testCases = [
    { province: 'ON', expectedRate: 0.13, type: 'HST' },
    { province: 'BC', expectedRate: 0.12, type: 'GST+PST' },
    { province: 'QC', expectedRate: 0.14975, type: 'GST+QST' },
    { province: 'AB', expectedRate: 0.05, type: 'GST' },
    { province: 'NS', expectedRate: 0.15, type: 'HST' }
  ];

  testCases.forEach(({ province, expectedRate, type }) => {
    test(`should calculate correct rate for ${province} (${type})`, () => {
      const result = calculateCanadianTax(10000, province as CanadianProvince);
      const actualRate = result.totalTax / result.subtotal;
      
      expect(actualRate).toBeCloseTo(expectedRate, 4);
    });
  });

  test('should handle all Canadian provinces and territories', () => {
    const provinces = Object.values(CanadianProvince);
    
    provinces.forEach(province => {
      expect(() => {
        const taxInfo = getProvinceTaxInfo(province);
        expect(taxInfo.province).toBe(province);
        expect(taxInfo.description).toBeTruthy();
      }).not.toThrow();
    });
  });

  test('effective tax rates should be reasonable', () => {
    Object.values(CanadianProvince).forEach(province => {
      const effectiveRate = getEffectiveTaxRate(province);
      
      expect(effectiveRate).toBeGreaterThan(0.04); // At least 4%
      expect(effectiveRate).toBeLessThan(0.20); // Less than 20%
    });
  });
});
```

---

## Production Monitoring

### Health Check Implementation

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';

export async function GET() {
  const checks = {
    database: false,
    stripe: false,
    timestamp: new Date().toISOString()
  };

  try {
    // Database health check
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  try {
    // Stripe health check
    await stripe.accounts.retrieve();
    checks.stripe = true;
  } catch (error) {
    console.error('Stripe health check failed:', error);
  }

  const healthy = checks.database && checks.stripe;
  const status = healthy ? 200 : 503;

  return NextResponse.json(checks, { status });
}
```

### Monitoring Metrics

```typescript
// src/lib/monitoring/metrics.ts
export interface PaymentMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  paymentSuccessRate: number;
  failedPayments: number;
  refundRate: number;
  subscriptionChurnRate: number;
}

export async function getPaymentMetrics(
  startDate: Date,
  endDate: Date
): Promise<PaymentMetrics> {
  const [
    orders,
    payments,
    refunds,
    subscriptions
  ] = await Promise.all([
    db.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED'
      }
    }),
    db.payment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate }
      }
    }),
    db.refund.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'SUCCEEDED'
      }
    }),
    db.subscription.findMany({
      where: {
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { canceledAt: { gte: startDate, lte: endDate } }
        ]
      }
    })
  ]);

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const successfulPayments = payments.filter(p => p.status === 'SUCCEEDED').length;
  const totalRefunds = refunds.reduce((sum, refund) => sum + refund.amount, 0);

  return {
    totalRevenue: totalRevenue - totalRefunds,
    totalOrders: orders.length,
    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    paymentSuccessRate: payments.length > 0 ? successfulPayments / payments.length : 0,
    failedPayments: payments.filter(p => p.status === 'FAILED').length,
    refundRate: totalRevenue > 0 ? totalRefunds / totalRevenue : 0,
    subscriptionChurnRate: calculateChurnRate(subscriptions, startDate, endDate)
  };
}

function calculateChurnRate(subscriptions: any[], startDate: Date, endDate: Date): number {
  const activeAtStart = subscriptions.filter(s => 
    s.createdAt < startDate && (!s.canceledAt || s.canceledAt > startDate)
  ).length;

  const canceledDuringPeriod = subscriptions.filter(s =>
    s.canceledAt && s.canceledAt >= startDate && s.canceledAt <= endDate
  ).length;

  return activeAtStart > 0 ? canceledDuringPeriod / activeAtStart : 0;
}
```

### Error Tracking

```typescript
// src/lib/monitoring/error-tracking.ts
export class ErrorTracker {
  static async trackPaymentError(error: {
    type: string;
    message: string;
    userId?: string;
    orderId?: string;
    paymentIntentId?: string;
    metadata?: Record<string, any>;
  }) {
    // Log to database
    await db.auditLog.create({
      data: {
        userId: error.userId || null,
        action: 'CREATE',
        resource: 'error',
        resourceId: error.orderId || error.paymentIntentId || 'unknown',
        description: `Payment Error: ${error.type} - ${error.message}`,
        newValues: {
          errorType: error.type,
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
          ...error.metadata
        }
      }
    });

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // await sendToSentry(error);
      // await sendToDatadog(error);
      console.error('Payment Error:', error);
    }
  }

  static async trackWebhookError(error: {
    eventId: string;
    eventType: string;
    message: string;
    attempts: number;
  }) {
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'webhook_error',
        resourceId: error.eventId,
        description: `Webhook Error: ${error.eventType} - ${error.message}`,
        newValues: {
          eventType: error.eventType,
          errorMessage: error.message,
          attempts: error.attempts,
          timestamp: new Date().toISOString()
        }
      }
    });
  }
}
```

---

## Test Execution and CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        run: |
          npx prisma migrate deploy
          npx prisma generate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          STRIPE_TEST_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          STRIPE_TEST_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          STRIPE_TEST_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

### Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:load": "k6 run tests/performance/load-test.js",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

This comprehensive testing strategy ensures the payment system is reliable, secure, and performant across all scenarios. The combination of unit, integration, and end-to-end tests provides confidence in the system's behavior while the performance and security tests ensure it can handle production loads safely.