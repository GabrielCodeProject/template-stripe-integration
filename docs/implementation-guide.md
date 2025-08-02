# Implementation Guide and Code Examples
## NextJS Stripe Payment Template

Complete implementation guide with production-ready code examples for integrating the payment system into your NextJS application.

---

## Table of Contents

1. [Quick Start Setup](#quick-start-setup)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Frontend Components](#frontend-components)
5. [API Route Implementation](#api-route-implementation)
6. [Webhook Integration](#webhook-integration)
7. [Subscription Management](#subscription-management)
8. [Error Handling](#error-handling)
9. [Testing Implementation](#testing-implementation)
10. [Production Deployment](#production-deployment)

---

## Quick Start Setup

### Installation

```bash
# Clone or create your NextJS project
npx create-next-app@latest your-app-name --typescript --tailwind --eslint

# Install required dependencies
npm install stripe @stripe/stripe-js prisma @prisma/client
npm install bcryptjs jsonwebtoken
npm install @types/bcryptjs @types/jsonwebtoken

# Install development dependencies
npm install -D jest @types/jest ts-jest playwright @playwright/test
```

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── payments/
│   │   ├── subscriptions/
│   │   ├── webhooks/
│   │   └── tax/
│   ├── components/
│   │   ├── ui/
│   │   ├── payment/
│   │   └── subscription/
│   └── lib/
│       ├── stripe/
│       ├── tax/
│       ├── errors/
│       ├── security/
│       └── subscriptions/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Environment Configuration

### Environment Variables

```bash
# .env.local
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/stripe_template"

# Stripe
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Security
ENCRYPTION_KEY="64-character-hex-key-for-data-encryption"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_PRIVACY_POLICY_URL="http://localhost:3000/privacy"
NEXT_PUBLIC_TERMS_OF_SERVICE_URL="http://localhost:3000/terms"

# Email (Optional)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="noreply@example.com"
SMTP_PASS="password"
```

### Stripe Client Setup

```typescript
// src/lib/stripe/client.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// Frontend Stripe instance
// src/lib/stripe/client-side.ts
import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);
```

---

## Database Setup

### Initialize Prisma

```bash
# Initialize Prisma
npx prisma init

# Copy the schema.prisma from the project
# Generate Prisma client
npx prisma generate

# Create and run migrations
npx prisma migrate dev --name init

# Seed the database (optional)
npx prisma db seed
```

### Database Client

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

---

## Frontend Components

### Payment Form Component

```typescript
// src/components/payment/CheckoutForm.tsx
'use client';

import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CheckoutFormProps {
  clientSecret: string;
  onSuccess: (paymentIntent: any) => void;
  onError: (error: string) => void;
}

export default function CheckoutForm({
  clientSecret,
  onSuccess,
  onError
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
        redirect: 'if_required'
      });

      if (error) {
        setErrorMessage(error.message || 'An error occurred');
        onError(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent);
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred');
      onError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
          <PaymentElement 
            options={{
              layout: 'tabs'
            }}
          />
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={!stripe || isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Processing...' : 'Complete Payment'}
        </Button>
      </form>
    </Card>
  );
}
```

### Tax Calculator Component

```typescript
// src/components/payment/TaxCalculator.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { CanadianProvince } from '@prisma/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

interface TaxCalculatorProps {
  subtotal: number;
  onTaxCalculated: (taxCalculation: any) => void;
}

const PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'YT', label: 'Yukon' }
];

export default function TaxCalculator({ subtotal, onTaxCalculated }: TaxCalculatorProps) {
  const [selectedProvince, setSelectedProvince] = useState<CanadianProvince>('ON');
  const [taxCalculation, setTaxCalculation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    calculateTax();
  }, [selectedProvince, subtotal]);

  const calculateTax = async () => {
    if (subtotal <= 0) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tax/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ unitPrice: subtotal, quantity: 1, productType: 'DIGITAL' }],
          province: selectedProvince
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTaxCalculation(data.calculation);
        onTaxCalculated(data.calculation);
      }
    } catch (error) {
      console.error('Tax calculation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount / 100);
  };

  return (
    <Card className="p-4" data-testid="tax-calculator">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Province/Territory
          </label>
          <Select 
            value={selectedProvince} 
            onValueChange={(value) => setSelectedProvince(value as CanadianProvince)}
            data-testid="province-selector"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select province" />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map((province) => (
                <SelectItem key={province.value} value={province.value}>
                  {province.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {taxCalculation && !isLoading && (
          <div className="space-y-2 text-sm" data-testid="tax-display">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(taxCalculation.subtotal)}</span>
            </div>
            
            {taxCalculation.breakdown.hst && (
              <div className="flex justify-between">
                <span>HST ({(taxCalculation.breakdown.hst.rate * 100).toFixed(1)}%):</span>
                <span>{formatCurrency(taxCalculation.breakdown.hst.amount)}</span>
              </div>
            )}
            
            {taxCalculation.breakdown.gst && (
              <div className="flex justify-between">
                <span>GST ({(taxCalculation.breakdown.gst.rate * 100).toFixed(1)}%):</span>
                <span>{formatCurrency(taxCalculation.breakdown.gst.amount)}</span>
              </div>
            )}
            
            {taxCalculation.breakdown.pst && (
              <div className="flex justify-between">
                <span>PST ({(taxCalculation.breakdown.pst.rate * 100).toFixed(1)}%):</span>
                <span>{formatCurrency(taxCalculation.breakdown.pst.amount)}</span>
              </div>
            )}
            
            {taxCalculation.breakdown.qst && (
              <div className="flex justify-between">
                <span>QST ({(taxCalculation.breakdown.qst.rate * 100).toFixed(3)}%):</span>
                <span>{formatCurrency(taxCalculation.breakdown.qst.amount)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(taxCalculation.total)}</span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center text-sm text-gray-500">
            Calculating taxes...
          </div>
        )}
      </div>
    </Card>
  );
}
```

### Subscription Management Component

```typescript
// src/components/subscription/SubscriptionCard.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SubscriptionCardProps {
  subscription: {
    id: string;
    status: string;
    plan: {
      name: string;
      billingInterval: string;
    };
    price: number;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
  onCancel: (subscriptionId: string) => void;
  onReactivate: (subscriptionId: string) => void;
}

export default function SubscriptionCard({
  subscription,
  onCancel,
  onReactivate
}: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await onCancel(subscription.id);
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Cancellation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async () => {
    setIsLoading(true);
    try {
      await onReactivate(subscription.id);
    } catch (error) {
      console.error('Reactivation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'PAST_DUE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">{subscription.plan.name}</h3>
          <p className="text-gray-600">
            {formatCurrency(subscription.price)} / {subscription.plan.billingInterval}
          </p>
        </div>
        <Badge className={getStatusColor(subscription.status)}>
          {subscription.status}
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <p>Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
        {subscription.cancelAtPeriodEnd && (
          <Alert>
            <AlertDescription>
              Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex gap-2">
        {subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd && (
          <Button
            variant="outline"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
          >
            Cancel Subscription
          </Button>
        )}

        {subscription.cancelAtPeriodEnd && (
          <Button
            onClick={handleReactivate}
            disabled={isLoading}
          >
            Reactivate Subscription
          </Button>
        )}

        <Button variant="outline" asChild>
          <a href="/api/billing-portal" target="_blank">
            Manage Billing
          </a>
        </Button>
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Cancel Subscription</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(false)}
                disabled={isLoading}
              >
                Keep Subscription
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isLoading}
              >
                {isLoading ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}
```

---

## API Route Implementation

### Payment Intent Creation

```typescript
// src/app/api/payments/create-intent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { db } from '@/lib/db';
import { calculateCanadianTax } from '@/lib/tax/canadian-tax';
import { securityMiddleware } from '@/lib/security/pci-compliance';

export async function POST(req: NextRequest) {
  // Apply security middleware
  const security = await securityMiddleware(req);
  if (!security.allowed) {
    return security.response;
  }

  try {
    const body = await req.json();
    const { items, billingAddress, promoCode, customerEmail } = body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    if (!billingAddress || !billingAddress.province) {
      return NextResponse.json(
        { error: 'Billing address with province is required' },
        { status: 400 }
      );
    }

    // Calculate order totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId }
      });

      if (!product || product.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: `Product ${item.productId} not found or inactive` },
          { status: 400 }
        );
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      });
    }

    // Apply promo code if provided
    let discountAmount = 0;
    if (promoCode) {
      const promo = await db.promoCode.findFirst({
        where: {
          code: promoCode,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      if (promo) {
        if (promo.type === 'PERCENTAGE') {
          discountAmount = Math.round(subtotal * (promo.discountPercent! / 100));
        } else if (promo.type === 'FIXED_AMOUNT') {
          discountAmount = Math.min(promo.discountAmount!, subtotal);
        }
      }
    }

    const discountedSubtotal = subtotal - discountAmount;

    // Calculate Canadian taxes
    const taxCalculation = calculateCanadianTax(
      discountedSubtotal,
      billingAddress.province
    );

    const totalAmount = discountedSubtotal + taxCalculation.totalTax;

    // Create order in database
    const order = await db.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        status: 'PENDING',
        subtotal,
        taxAmount: taxCalculation.totalTax,
        discountAmount,
        totalAmount,
        currency: 'CAD',
        customerEmail: customerEmail || 'guest@example.com',
        taxBreakdown: taxCalculation.breakdown,
        items: {
          create: orderItems
        }
      }
    });

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'cad',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    // Update order with Stripe Payment Intent ID
    await db.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id }
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          discountAmount: order.discountAmount,
          totalAmount: order.totalAmount,
          taxBreakdown: order.taxBreakdown
        }
      }
    });

  } catch (error) {
    console.error('Payment intent creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
```

### Subscription Creation API

```typescript
// src/app/api/subscriptions/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { subscriptionManager } from '@/lib/subscriptions/subscription-manager';
import { securityMiddleware } from '@/lib/security/pci-compliance';

export async function POST(req: NextRequest) {
  const security = await securityMiddleware(req);
  if (!security.allowed) {
    return security.response;
  }

  try {
    const body = await req.json();
    const {
      userId,
      planId,
      paymentMethodId,
      billingAddress,
      promoCode,
      trialDays
    } = body;

    // Validate required fields
    if (!userId || !planId || !paymentMethodId || !billingAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create subscription
    const result = await subscriptionManager.createSubscription({
      userId,
      planId,
      paymentMethodId,
      billingAddress,
      promoCode,
      trialDays
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Subscription creation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
```

### Tax Calculation API

```typescript
// src/app/api/tax/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calculateCanadianTax } from '@/lib/tax/canadian-tax';
import { CanadianProvince } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, province, promoCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    if (!province) {
      return NextResponse.json(
        { error: 'Province is required' },
        { status: 400 }
      );
    }

    // Calculate subtotal
    const subtotal = items.reduce((total, item) => {
      return total + (item.unitPrice * item.quantity);
    }, 0);

    // Apply promo code discount if provided
    let discountAmount = 0;
    let discountApplied = null;

    if (promoCode) {
      // In a real implementation, you'd fetch from database
      // This is a simplified example
      if (promoCode === 'SAVE10') {
        discountAmount = Math.round(subtotal * 0.1);
        discountApplied = {
          code: promoCode,
          type: 'PERCENTAGE',
          discountPercent: 10,
          discountAmount
        };
      }
    }

    const discountedSubtotal = subtotal - discountAmount;

    // Calculate taxes
    const taxCalculation = calculateCanadianTax(
      discountedSubtotal,
      province as CanadianProvince
    );

    return NextResponse.json({
      success: true,
      data: {
        calculation: {
          ...taxCalculation,
          discountAmount
        },
        discountApplied
      }
    });

  } catch (error) {
    console.error('Tax calculation failed:', error);
    return NextResponse.json(
      { error: 'Tax calculation failed' },
      { status: 500 }
    );
  }
}
```

---

## Webhook Integration

### Complete Webhook Handler

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processWebhookEvent } from '@/lib/stripe/webhook-handlers';
import { stripe } from '@/lib/stripe/client';
import { db } from '@/lib/db';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get('stripe-signature');
  
  if (!sig) {
    console.error('Missing Stripe signature header');
    return NextResponse.json(
      { error: 'Missing signature header' },
      { status: 400 }
    );
  }

  const body = await req.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Check for duplicate events (idempotency)
  try {
    const existingEvent = await db.webhookEvent.findUnique({
      where: { stripeEventId: event.id }
    });

    if (existingEvent && existingEvent.processed) {
      console.log(`Duplicate webhook event ignored: ${event.id}`);
      return NextResponse.json({ received: true });
    }

    // Process the webhook event
    await processWebhookEvent(event);

    // Mark event as processed
    await db.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: { 
        processed: true,
        processedAt: new Date(),
        attempts: { increment: 1 }
      },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        processed: true,
        processedAt: new Date(),
        attempts: 1,
        eventData: event.data.object as any
      }
    });

    console.log(`Successfully processed webhook: ${event.type} (${event.id})`);
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook processing failed:', error);

    // Log failed processing attempt
    await db.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: { 
        error: error.message,
        attempts: { increment: 1 },
        lastAttemptAt: new Date()
      },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        processed: false,
        error: error.message,
        attempts: 1,
        lastAttemptAt: new Date(),
        eventData: event.data.object as any
      }
    });

    // Return 500 to trigger Stripe retry
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

---

## Production Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/stripe_template
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: stripe_template
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Production Environment Variables

```bash
# .env.production
DATABASE_URL="postgresql://user:password@production-db:5432/stripe_template"
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXTAUTH_SECRET="production-secret-key"
NEXTAUTH_URL="https://yourdomain.com"
ENCRYPTION_KEY="production-encryption-key"
```

### Deployment Checklist

#### Pre-Deployment
- [ ] Update environment variables for production
- [ ] Configure production database
- [ ] Set up Stripe webhook endpoints
- [ ] Configure SSL certificates
- [ ] Set up monitoring and logging
- [ ] Run security audit

#### Stripe Configuration
- [ ] Switch to live API keys
- [ ] Configure webhook endpoints: `https://yourdomain.com/api/webhooks/stripe`
- [ ] Set up customer portal domain
- [ ] Configure tax settings if needed
- [ ] Test payment flows in live mode

#### Security
- [ ] Enable HTTPS enforcement
- [ ] Configure CORS policies
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Configure firewall rules
- [ ] Set up intrusion detection

#### Monitoring
- [ ] Set up application monitoring (e.g., DataDog, New Relic)
- [ ] Configure error tracking (e.g., Sentry)
- [ ] Set up uptime monitoring
- [ ] Configure payment failure alerts
- [ ] Set up database monitoring

---

## Testing Implementation

### Integration Test Example

```typescript
// tests/integration/payment-flow.test.ts
import { testDb } from '../test-setup';
import { stripe } from '@/lib/stripe/client';

describe('Payment Integration', () => {
  beforeEach(async () => {
    await testDb.order.deleteMany();
    await testDb.user.deleteMany();
  });

  test('complete payment flow', async () => {
    // Create test user
    const user = await testDb.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      }
    });

    // Create test product
    const product = await testDb.product.create({
      data: {
        name: 'Test Product',
        slug: 'test-product',
        type: 'DIGITAL',
        status: 'ACTIVE',
        price: 2999,
        stripeProductId: 'prod_test',
        stripePriceId: 'price_test'
      }
    });

    // Test payment intent creation
    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        billingAddress: {
          firstName: 'Test',
          lastName: 'User',
          addressLine1: '123 Test St',
          city: 'Toronto',
          province: 'ON',
          postalCode: 'M5V 3A1',
          country: 'CA'
        },
        customerEmail: user.email
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.paymentIntent.amount).toBe(3389); // Including tax
  });
});
```

This implementation guide provides everything needed to integrate the payment system into a NextJS application. The code examples are production-ready and include proper error handling, security measures, and Canadian tax compliance.