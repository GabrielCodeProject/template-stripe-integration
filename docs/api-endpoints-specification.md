# API Endpoint Specifications
## NextJS Stripe Payment Template

Complete API specification for payment processing, subscription management, and e-commerce functionality.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Product Management](#product-management)
3. [Payment Processing](#payment-processing)
4. [Subscription Management](#subscription-management)
5. [Order Management](#order-management)
6. [Customer Management](#customer-management)
7. [Tax Calculation](#tax-calculation)
8. [Webhook Endpoints](#webhook-endpoints)
9. [Admin Dashboard](#admin-dashboard)
10. [Error Handling](#error-handling)

---

## Base Configuration

**Base URL**: `https://yourapp.com/api`  
**Content-Type**: `application/json`  
**Authentication**: Bearer Token / Session-based  
**Rate Limiting**: Varies by endpoint (documented below)

---

## Authentication & Authorization

### POST /auth/login
**Purpose**: Authenticate user and create session  
**Rate Limit**: 5 requests/minute  
**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "CUSTOMER",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "jwt_token_here",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Error Responses**:
- `400`: Invalid credentials
- `429`: Too many attempts
- `500`: Server error

### POST /auth/register
**Purpose**: Register new user account  
**Rate Limit**: 3 requests/minute  
**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-123-4567",
  "address": {
    "firstName": "John",
    "lastName": "Doe",
    "addressLine1": "123 Main St",
    "city": "Toronto",
    "province": "ON",
    "postalCode": "M5V 3A1",
    "country": "CA"
  }
}
```

**Response (201)**:
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "emailVerified": false
  },
  "message": "Registration successful. Please verify your email."
}
```

### POST /auth/logout
**Purpose**: Invalidate user session  
**Authentication**: Required  

**Response (200)**:
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

---

## Product Management

### GET /products
**Purpose**: Retrieve product catalog  
**Rate Limit**: 100 requests/minute  
**Authentication**: None required

**Query Parameters**:
- `category`: Filter by category slug
- `type`: Filter by product type (`DIGITAL`, `PHYSICAL`, `SUBSCRIPTION`)
- `page`: Page number (default: 1)
- `limit`: Items per page (max: 50, default: 20)
- `sort`: Sort order (`price_asc`, `price_desc`, `created_desc`, `name_asc`)
- `featured`: Filter featured products (`true`/`false`)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_123",
        "name": "Premium Workout Plan",
        "slug": "premium-workout-plan",
        "description": "Complete 12-week workout program",
        "shortDescription": "Transform your fitness in 12 weeks",
        "type": "DIGITAL",
        "status": "ACTIVE",
        "price": 4999,
        "compareAtPrice": 7999,
        "currency": "CAD",
        "featured": true,
        "category": {
          "id": "cat_123",
          "name": "Workout Plans",
          "slug": "workout-plans"
        },
        "images": [
          {
            "id": "img_123",
            "url": "https://cdn.example.com/image.jpg",
            "altText": "Premium Workout Plan Cover",
            "isPrimary": true
          }
        ],
        "downloadInfo": {
          "fileSize": 15728640,
          "downloadLimit": 5,
          "downloadExpiry": 30
        },
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T14:20:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 98,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

### GET /products/{slug}
**Purpose**: Get product details by slug  
**Rate Limit**: 200 requests/minute  
**Authentication**: None required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "prod_123",
      "name": "Premium Workout Plan",
      "slug": "premium-workout-plan",
      "description": "Complete 12-week workout program with nutrition guide",
      "shortDescription": "Transform your fitness in 12 weeks",
      "type": "DIGITAL",
      "status": "ACTIVE",
      "price": 4999,
      "compareAtPrice": 7999,
      "currency": "CAD",
      "featured": true,
      "metaTitle": "Premium Workout Plan - Transform Your Fitness",
      "metaDescription": "Get fit with our proven 12-week workout program",
      "category": {
        "id": "cat_123",
        "name": "Workout Plans",
        "slug": "workout-plans"
      },
      "images": [
        {
          "id": "img_123",
          "url": "https://cdn.example.com/image.jpg",
          "altText": "Premium Workout Plan Cover",
          "isPrimary": true,
          "sortOrder": 0
        }
      ],
      "variants": [],
      "subscriptionPlans": [
        {
          "id": "plan_123",
          "name": "Monthly Access",
          "price": 2999,
          "billingInterval": "month",
          "trialDays": 7,
          "stripePriceId": "price_stripe123"
        }
      ],
      "downloadInfo": {
        "fileSize": 15728640,
        "downloadLimit": 5,
        "downloadExpiry": 30,
        "fileMimeType": "application/pdf"
      },
      "reviews": {
        "averageRating": 4.8,
        "totalReviews": 156
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:20:00Z"
    }
  }
}
```

---

## Payment Processing

### POST /payments/create-intent
**Purpose**: Create Stripe Payment Intent for one-time purchases  
**Rate Limit**: 50 requests/minute  
**Authentication**: Required

**Request Body**:
```json
{
  "items": [
    {
      "productId": "prod_123",
      "variantId": "var_456",
      "quantity": 1
    }
  ],
  "promoCode": "SAVE20",
  "billingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "addressLine1": "123 Main St",
    "city": "Toronto",
    "province": "ON",
    "postalCode": "M5V 3A1",
    "country": "CA"
  },
  "customerEmail": "john@example.com"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "paymentIntent": {
      "id": "pi_stripe123",
      "clientSecret": "pi_stripe123_secret_abc123",
      "amount": 5739,
      "currency": "cad",
      "status": "requires_payment_method"
    },
    "order": {
      "id": "order_123",
      "orderNumber": "ORD-2024-001234",
      "subtotal": 4999,
      "taxAmount": 650,
      "discountAmount": 500,
      "totalAmount": 5149,
      "taxBreakdown": {
        "province": "ON",
        "breakdown": {
          "hst": {
            "rate": 0.13,
            "amount": 650
          }
        }
      }
    }
  }
}
```

### POST /payments/confirm
**Purpose**: Confirm payment and complete order  
**Rate Limit**: 20 requests/minute  
**Authentication**: Required

**Request Body**:
```json
{
  "paymentIntentId": "pi_stripe123",
  "paymentMethodId": "pm_stripe456"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order_123",
      "orderNumber": "ORD-2024-001234",
      "status": "COMPLETED",
      "totalAmount": 5149,
      "completedAt": "2024-01-20T15:30:00Z"
    },
    "downloads": [
      {
        "id": "download_123",
        "productName": "Premium Workout Plan",
        "fileName": "workout-plan.pdf",
        "downloadUrl": "/downloads/secure/download_123",
        "expiresAt": "2024-02-20T15:30:00Z",
        "downloadLimit": 5,
        "downloadCount": 0
      }
    ]
  }
}
```

### GET /payments/{paymentIntentId}/status
**Purpose**: Check payment status  
**Rate Limit**: 100 requests/minute  
**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "paymentIntent": {
      "id": "pi_stripe123",
      "status": "succeeded",
      "amount": 5149,
      "currency": "cad"
    },
    "order": {
      "id": "order_123",
      "status": "COMPLETED",
      "orderNumber": "ORD-2024-001234"
    }
  }
}
```

---

## Subscription Management

### GET /subscriptions/plans
**Purpose**: Get available subscription plans  
**Rate Limit**: 100 requests/minute  
**Authentication**: None required

**Query Parameters**:
- `productId`: Filter by product ID
- `billingInterval`: Filter by interval (`month`, `year`)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "plan_123",
        "productId": "prod_123",
        "name": "Premium Monthly",
        "description": "Full access to all workout plans",
        "price": 2999,
        "billingInterval": "month",
        "trialDays": 7,
        "stripePriceId": "price_stripe123",
        "features": [
          "Access to all workout plans",
          "Nutrition guides",
          "Progress tracking",
          "Email support"
        ],
        "maxUsers": 1,
        "maxDownloads": null,
        "isActive": true,
        "product": {
          "id": "prod_123",
          "name": "Premium Fitness Program",
          "type": "SUBSCRIPTION"
        }
      }
    ]
  }
}
```

### POST /subscriptions/create
**Purpose**: Create new subscription  
**Rate Limit**: 10 requests/minute  
**Authentication**: Required

**Request Body**:
```json
{
  "planId": "plan_123",
  "paymentMethodId": "pm_stripe456",
  "promoCode": "FIRSTMONTH50",
  "billingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "addressLine1": "123 Main St",
    "city": "Toronto",
    "province": "ON",
    "postalCode": "M5V 3A1",
    "country": "CA"
  }
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "stripeSubscriptionId": "sub_stripe123",
      "status": "active",
      "currentPeriodStart": "2024-01-20T15:30:00Z",
      "currentPeriodEnd": "2024-02-20T15:30:00Z",
      "trialStart": "2024-01-20T15:30:00Z",
      "trialEnd": "2024-01-27T15:30:00Z",
      "price": 2999,
      "currency": "CAD",
      "plan": {
        "id": "plan_123",
        "name": "Premium Monthly",
        "billingInterval": "month"
      }
    },
    "customer": {
      "stripeCustomerId": "cus_stripe123"
    }
  }
}
```

### GET /subscriptions
**Purpose**: Get user's subscriptions  
**Rate Limit**: 50 requests/minute  
**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "id": "sub_123",
        "stripeSubscriptionId": "sub_stripe123",
        "status": "active",
        "currentPeriodStart": "2024-01-20T15:30:00Z",
        "currentPeriodEnd": "2024-02-20T15:30:00Z",
        "cancelAtPeriodEnd": false,
        "trialEnd": "2024-01-27T15:30:00Z",
        "price": 2999,
        "currency": "CAD",
        "plan": {
          "id": "plan_123",
          "name": "Premium Monthly",
          "billingInterval": "month",
          "product": {
            "id": "prod_123",
            "name": "Premium Fitness Program"
          }
        },
        "nextInvoice": {
          "date": "2024-02-20T15:30:00Z",
          "amount": 2999
        }
      }
    ]
  }
}
```

### POST /subscriptions/{id}/cancel
**Purpose**: Cancel subscription  
**Rate Limit**: 5 requests/minute  
**Authentication**: Required

**Request Body**:
```json
{
  "cancelAtPeriodEnd": true,
  "cancellationReason": "no_longer_needed",
  "feedback": "Found a different solution"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "status": "active",
      "cancelAtPeriodEnd": true,
      "canceledAt": "2024-01-20T16:00:00Z",
      "currentPeriodEnd": "2024-02-20T15:30:00Z"
    },
    "message": "Subscription will cancel at the end of the current period"
  }
}
```

### POST /subscriptions/{id}/reactivate
**Purpose**: Reactivate cancelled subscription  
**Rate Limit**: 5 requests/minute  
**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "status": "active",
      "cancelAtPeriodEnd": false,
      "canceledAt": null
    },
    "message": "Subscription reactivated successfully"
  }
}
```

---

## Order Management

### GET /orders
**Purpose**: Get user's order history  
**Rate Limit**: 50 requests/minute  
**Authentication**: Required

**Query Parameters**:
- `status`: Filter by order status
- `page`: Page number (default: 1)
- `limit`: Items per page (max: 50, default: 10)
- `dateFrom`: Filter orders from date (ISO 8601)
- `dateTo`: Filter orders to date (ISO 8601)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order_123",
        "orderNumber": "ORD-2024-001234",
        "status": "COMPLETED",
        "subtotal": 4999,
        "taxAmount": 650,
        "discountAmount": 0,
        "totalAmount": 5649,
        "currency": "CAD",
        "customerEmail": "john@example.com",
        "items": [
          {
            "id": "item_123",
            "productId": "prod_123",
            "name": "Premium Workout Plan",
            "quantity": 1,
            "unitPrice": 4999,
            "totalPrice": 4999,
            "downloadInfo": {
              "downloadLimit": 5,
              "downloadExpiry": "2024-02-20T15:30:00Z"
            }
          }
        ],
        "downloads": [
          {
            "id": "download_123",
            "fileName": "workout-plan.pdf",
            "downloadCount": 2,
            "downloadLimit": 5,
            "isActive": true
          }
        ],
        "createdAt": "2024-01-20T15:30:00Z",
        "completedAt": "2024-01-20T15:32:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 27,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

### GET /orders/{orderNumber}
**Purpose**: Get specific order details  
**Rate Limit**: 100 requests/minute  
**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order_123",
      "orderNumber": "ORD-2024-001234",
      "status": "COMPLETED",
      "subtotal": 4999,
      "taxAmount": 650,
      "discountAmount": 0,
      "totalAmount": 5649,
      "currency": "CAD",
      "customerEmail": "john@example.com",
      "billingAddress": {
        "firstName": "John",
        "lastName": "Doe",
        "addressLine1": "123 Main St",
        "city": "Toronto",
        "province": "ON",
        "postalCode": "M5V 3A1",
        "country": "CA"
      },
      "taxBreakdown": {
        "province": "ON",
        "breakdown": {
          "hst": {
            "rate": 0.13,
            "amount": 650
          }
        }
      },
      "items": [
        {
          "id": "item_123",
          "productId": "prod_123",
          "name": "Premium Workout Plan",
          "description": "Complete 12-week workout program",
          "quantity": 1,
          "unitPrice": 4999,
          "totalPrice": 4999,
          "downloadInfo": {
            "downloadLimit": 5,
            "downloadExpiry": "2024-02-20T15:30:00Z"
          }
        }
      ],
      "payments": [
        {
          "id": "payment_123",
          "status": "SUCCEEDED",
          "amount": 5649,
          "stripePaymentIntentId": "pi_stripe123",
          "receiptUrl": "https://pay.stripe.com/receipts/...",
          "processedAt": "2024-01-20T15:32:00Z"
        }
      ],
      "downloads": [
        {
          "id": "download_123",
          "fileName": "workout-plan.pdf",
          "fileSize": 15728640,
          "downloadCount": 2,
          "downloadLimit": 5,
          "isActive": true,
          "expiresAt": "2024-02-20T15:30:00Z",
          "lastDownloadAt": "2024-01-21T10:15:00Z"
        }
      ],
      "createdAt": "2024-01-20T15:30:00Z",
      "completedAt": "2024-01-20T15:32:00Z"
    }
  }
}
```

---

## Tax Calculation

### POST /tax/calculate
**Purpose**: Calculate Canadian taxes for cart items  
**Rate Limit**: 100 requests/minute  
**Authentication**: None required

**Request Body**:
```json
{
  "items": [
    {
      "productId": "prod_123",
      "quantity": 1,
      "unitPrice": 4999,
      "productType": "DIGITAL"
    }
  ],
  "province": "ON",
  "promoCode": "SAVE10"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "calculation": {
      "subtotal": 4999,
      "discountAmount": 500,
      "taxableAmount": 4499,
      "totalTax": 585,
      "total": 5084,
      "province": "ON",
      "breakdown": {
        "hst": {
          "rate": 0.13,
          "amount": 585
        }
      },
      "summary": [
        "HST (13.0%): $5.85 CAD",
        "Total Tax: $5.85 CAD"
      ]
    },
    "discountApplied": {
      "code": "SAVE10",
      "type": "PERCENTAGE",
      "discountPercent": 10,
      "discountAmount": 500
    }
  }
}
```

### GET /tax/rates/{province}
**Purpose**: Get tax rates for a specific province  
**Rate Limit**: 200 requests/minute  
**Authentication**: None required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "province": "ON",
    "rates": {
      "hst": 0.13,
      "effectiveDate": "2024-01-01T00:00:00Z",
      "description": "Ontario - HST (13%)"
    },
    "effectiveRate": 0.13
  }
}
```

---

## Customer Management

### GET /customers/profile
**Purpose**: Get customer profile  
**Rate Limit**: 50 requests/minute  
**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "user_123",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1-555-123-4567",
      "emailVerified": true,
      "stripeCustomerId": "cus_stripe123",
      "address": {
        "firstName": "John",
        "lastName": "Doe",
        "addressLine1": "123 Main St",
        "city": "Toronto",
        "province": "ON",
        "postalCode": "M5V 3A1",
        "country": "CA"
      },
      "createdAt": "2024-01-01T12:00:00Z",
      "lastLoginAt": "2024-01-20T15:00:00Z"
    }
  }
}
```

### PUT /customers/profile
**Purpose**: Update customer profile  
**Rate Limit**: 10 requests/minute  
**Authentication**: Required

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-123-4567",
  "address": {
    "firstName": "John",
    "lastName": "Doe",
    "addressLine1": "456 Oak St",
    "city": "Vancouver",
    "province": "BC",
    "postalCode": "V6B 1A1",
    "country": "CA"
  }
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "user_123",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1-555-123-4567",
      "address": {
        "firstName": "John",
        "lastName": "Doe",
        "addressLine1": "456 Oak St",
        "city": "Vancouver",
        "province": "BC",
        "postalCode": "V6B 1A1",
        "country": "CA"
      },
      "updatedAt": "2024-01-20T16:00:00Z"
    }
  }
}
```

### GET /customers/downloads
**Purpose**: Get customer's digital downloads  
**Rate Limit**: 50 requests/minute  
**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "id": "download_123",
        "productName": "Premium Workout Plan",
        "fileName": "workout-plan.pdf",
        "fileSize": 15728640,
        "downloadCount": 3,
        "downloadLimit": 5,
        "isActive": true,
        "expiresAt": "2024-02-20T15:30:00Z",
        "lastDownloadAt": "2024-01-21T10:15:00Z",
        "order": {
          "orderNumber": "ORD-2024-001234",
          "createdAt": "2024-01-20T15:30:00Z"
        }
      }
    ]
  }
}
```

### GET /customers/downloads/{downloadId}
**Purpose**: Secure download endpoint  
**Rate Limit**: 20 requests/minute  
**Authentication**: Required

**Response (302)**: Redirect to secure download URL  
**Response (404)**: Download not found or expired  
**Response (403)**: Download limit exceeded

---

## Webhook Endpoints

### POST /webhooks/stripe
**Purpose**: Handle Stripe webhook events  
**Rate Limit**: No limit (webhook verification)  
**Authentication**: Stripe signature verification

**Headers Required**:
- `stripe-signature`: Webhook signature

**Handled Events**:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

**Response (200)**:
```json
{
  "received": true
}
```

---

## Admin Dashboard

### GET /admin/analytics/overview
**Purpose**: Get dashboard overview metrics  
**Rate Limit**: 100 requests/minute  
**Authentication**: Required (Admin role)

**Query Parameters**:
- `period`: Time period (`7d`, `30d`, `90d`, `1y`)
- `timezone`: Timezone for calculations (default: UTC)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "revenue": {
      "total": 125000,
      "currency": "CAD",
      "growth": 15.5,
      "previousPeriod": 108000
    },
    "orders": {
      "total": 1250,
      "growth": 8.2,
      "averageValue": 10000
    },
    "subscriptions": {
      "active": 450,
      "growth": 12.1,
      "churnRate": 2.5,
      "mrr": 67500
    },
    "customers": {
      "total": 2180,
      "new": 125,
      "growth": 6.8
    },
    "topProducts": [
      {
        "id": "prod_123",
        "name": "Premium Workout Plan",
        "revenue": 45000,
        "units": 900,
        "growth": 22.5
      }
    ]
  }
}
```

### GET /admin/orders
**Purpose**: Get all orders for admin management  
**Rate Limit**: 200 requests/minute  
**Authentication**: Required (Admin/Support role)

**Query Parameters**:
- `status`: Filter by status
- `customer`: Filter by customer email
- `dateFrom`: Date range start
- `dateTo`: Date range end
- `page`: Page number
- `limit`: Items per page

**Response**: Similar to customer orders but includes all customers

### POST /admin/refunds/create
**Purpose**: Process refund for an order  
**Rate Limit**: 20 requests/minute  
**Authentication**: Required (Admin role)

**Request Body**:
```json
{
  "orderId": "order_123",
  "amount": 5000,
  "reason": "requested_by_customer",
  "description": "Customer requested refund",
  "revokeAccess": true
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "refund": {
      "id": "refund_123",
      "stripeRefundId": "re_stripe123",
      "amount": 5000,
      "status": "succeeded",
      "reason": "requested_by_customer",
      "processedAt": "2024-01-20T16:30:00Z"
    },
    "order": {
      "id": "order_123",
      "status": "REFUNDED",
      "orderNumber": "ORD-2024-001234"
    }
  }
}
```

---

## Error Handling

### Standard Error Response Format

All API endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-20T16:00:00Z",
    "requestId": "req_123abc"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_REQUIRED` | 401 | Authentication required |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `PAYMENT_FAILED` | 402 | Payment processing failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `STRIPE_ERROR` | 502 | Stripe API error |
| `TAX_CALCULATION_ERROR` | 422 | Tax calculation failed |
| `INVENTORY_ERROR` | 409 | Insufficient inventory |

### Rate Limiting Headers

All responses include rate limiting headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642694400
```

### Pagination Format

Paginated responses follow this structure:

```json
{
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 195,
    "itemsPerPage": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

## Security Considerations

### Authentication
- JWT tokens with 24-hour expiration
- Refresh token rotation
- Session management with secure cookies

### Rate Limiting
- IP-based rate limiting
- User-based rate limiting for authenticated endpoints
- Progressive delays for repeated violations

### Data Validation
- Strict input validation on all endpoints
- SQL injection prevention
- XSS protection

### PCI Compliance
- No card data storage
- Stripe tokenization for all payments
- Secure webhook signature verification

### CORS Policy
```javascript
{
  "origin": ["https://yourapp.com"],
  "methods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["Content-Type", "Authorization"],
  "credentials": true
}
```

This API specification provides a complete foundation for implementing the NextJS Stripe Payment Template with production-ready security, error handling, and Canadian tax compliance.