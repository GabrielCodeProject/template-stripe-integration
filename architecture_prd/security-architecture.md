# Security Architecture - NextJS Stripe Payment Template

## 1. Security Framework Overview

### 1.1 Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        PERIMETER LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│ • WAF (Web Application Firewall)                               │
│ • DDoS Protection                                              │
│ • Geographic IP Filtering                                      │
│ • Rate Limiting (Global & Per-IP)                              │
│ • SSL/TLS Termination                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│ • Input Validation & Sanitization                              │
│ • Authentication Middleware                                    │
│ • Authorization Checks                                         │
│ • CSRF Protection                                              │
│ • XSS Prevention                                               │
│ • SQL Injection Prevention                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│ • Encryption at Rest                                           │
│ • Encryption in Transit                                        │
│ • Database Access Controls                                     │
│ • Sensitive Data Masking                                       │
│ • Audit Logging                                                │
│ • Backup Encryption                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Security Compliance Framework

```
PCI DSS Level 1 Compliance:
├── Stripe Tokenization (No card data storage)
├── Secure Network Architecture
├── Strong Access Control Measures
├── Regular Security Testing
├── Maintain Information Security Policy
└── Vulnerability Management Program

Canadian Privacy Laws:
├── PIPEDA Compliance
├── Quebec Consumer Protection
├── Data Residency Requirements
└── Privacy Impact Assessments
```

## 2. Authentication & Authorization Architecture

### 2.1 BetterAuth Security Configuration

```typescript
// Security-focused BetterAuth configuration
export const authConfig = {
  // JWT Security
  jwt: {
    algorithm: "HS256",
    expiresIn: "15m", // Short-lived access tokens
    refreshTokenExpiresIn: "7d",
    issuer: "stripe-template",
    audience: "stripe-template-users"
  },
  
  // Session Security
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes
    updateAge: 5 * 60, // Update every 5 minutes
    generateSessionToken: () => crypto.randomUUID()
  },
  
  // Password Policies
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    maxAttempts: 5,
    lockoutDuration: 30 * 60 * 1000 // 30 minutes
  },
  
  // Account Security
  account: {
    emailVerificationRequired: true,
    maxLoginAttempts: 5,
    accountLockoutThreshold: 5,
    passwordResetTokenExpiry: 10 * 60 * 1000 // 10 minutes
  }
}
```

### 2.2 Role-Based Access Control (RBAC)

```typescript
// Permission-based authorization system
export const permissions = {
  // Product Management
  'products:create': ['admin'],
  'products:read': ['admin', 'customer', 'support'],
  'products:update': ['admin'],
  'products:delete': ['admin'],
  
  // Order Management
  'orders:create': ['customer'],
  'orders:read': ['admin', 'support', 'customer:own'],
  'orders:update': ['admin', 'support'],
  'orders:refund': ['admin', 'support'],
  
  // Customer Management
  'customers:read': ['admin', 'support', 'customer:own'],
  'customers:update': ['admin', 'customer:own'],
  'customers:delete': ['admin'],
  
  // Analytics Access
  'analytics:read': ['admin'],
  'analytics:limited': ['support'],
  
  // System Administration
  'admin:settings': ['admin'],
  'admin:users': ['admin'],
  'admin:audit': ['admin']
}

// Middleware for permission checking
export function requirePermission(permission: string) {
  return async (req: NextRequest, context: { params: any }) => {
    const session = await getSession(req)
    
    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    const hasPermission = await checkUserPermission(
      session.user.id, 
      permission,
      context.params
    )
    
    if (!hasPermission) {
      return new Response('Forbidden', { status: 403 })
    }
    
    return NextResponse.next()
  }
}
```

### 2.3 Multi-Factor Authentication (MFA)

```typescript
// MFA Implementation Strategy
export const mfaConfig = {
  // TOTP (Time-based One-Time Password)
  totp: {
    enabled: true,
    issuer: 'Stripe Template',
    algorithm: 'SHA256',
    digits: 6,
    period: 30,
    window: 2 // Allow 2 periods of tolerance
  },
  
  // SMS-based (Optional)
  sms: {
    enabled: false, // Can be enabled per user preference
    provider: 'twilio', // or preferred SMS provider
    templateId: 'mfa-code-template'
  },
  
  // Email-based Backup
  email: {
    enabled: true,
    backupCodesCount: 10,
    codeLength: 8,
    expiryMinutes: 10
  },
  
  // Recovery Options
  recovery: {
    backupCodes: true,
    adminOverride: true, // For customer support
    securityQuestions: false // Not recommended
  }
}
```

## 3. Input Validation & Sanitization

### 3.1 Zod Schema Validation

```typescript
// Comprehensive validation schemas
export const validationSchemas = {
  // User Registration
  userRegistration: z.object({
    email: z.string()
      .email('Invalid email format')
      .max(255, 'Email too long')
      .refine(email => !email.includes('+'), 'Plus signs not allowed'),
    password: z.string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
             'Password must contain uppercase, lowercase, number, and special character'),
    firstName: z.string()
      .min(1, 'First name required')
      .max(50, 'First name too long')
      .regex(/^[a-zA-Z\s\-']+$/, 'Invalid characters in first name'),
    lastName: z.string()
      .min(1, 'Last name required')
      .max(50, 'Last name too long')
      .regex(/^[a-zA-Z\s\-']+$/, 'Invalid characters in last name')
  }),
  
  // Payment Data
  paymentIntent: z.object({
    amount: z.number()
      .int('Amount must be integer')
      .min(50, 'Minimum $0.50 CAD') // Stripe minimum
      .max(99999999, 'Maximum amount exceeded'),
    currency: z.literal('cad'),
    productIds: z.array(z.string().uuid('Invalid product ID')),
    promoCode: z.string()
      .optional()
      .refine(code => !code || /^[A-Z0-9]{3,20}$/.test(code), 'Invalid promo code format')
  }),
  
  // Product Management
  productCreation: z.object({
    name: z.string()
      .min(1, 'Product name required')
      .max(200, 'Product name too long')
      .refine(name => !/<script|javascript:|on\w+=/i.test(name), 'Invalid characters'),
    description: z.string()
      .max(5000, 'Description too long')
      .refine(desc => !/<script|javascript:|on\w+=/i.test(desc), 'Invalid content'),
    price: z.number()
      .int('Price must be integer (cents)')
      .min(0, 'Price cannot be negative')
      .max(99999999, 'Price too high'),
    category: z.enum(['supplements', 'workout-plans', 'digital-products'])
  })
}

// Sanitization utilities
export const sanitizers = {
  html: (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br'],
      ALLOWED_ATTR: []
    })
  },
  
  filename: (input: string): string => {
    return input.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255)
  },
  
  sql: (input: string): string => {
    // Using parameterized queries, but additional safety
    return input.replace(/['";\\]/g, '')
  }
}
```

### 3.2 API Input Validation Middleware

```typescript
export function validateInput<T>(schema: z.ZodSchema<T>) {
  return async (req: NextRequest) => {
    try {
      const body = await req.json()
      const validatedData = schema.parse(body)
      
      // Attach validated data to request
      ;(req as any).validatedBody = validatedData
      
      return NextResponse.next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Validation failed', 
            details: error.errors 
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }
  }
}
```

## 4. API Security & Rate Limiting

### 4.1 Rate Limiting Strategy

```typescript
// Multi-tier rate limiting
export const rateLimitConfig = {
  // Global limits
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Requests per window
    message: 'Too many requests from this IP'
  },
  
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 10, // Login attempts
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts'
  },
  
  // Payment endpoints
  payment: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Payment attempts
    keyGenerator: (req) => `${req.ip}-${req.headers['user-agent']}`,
    message: 'Too many payment attempts'
  },
  
  // Admin endpoints
  admin: {
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: 'Admin rate limit exceeded'
  },
  
  // Webhook endpoints
  webhooks: {
    windowMs: 60 * 1000,
    max: 1000, // High limit for legitimate webhooks
    keyGenerator: (req) => req.headers['stripe-signature'] || req.ip
  }
}

// Redis-based rate limiter
export class RedisRateLimiter {
  private redis: Redis
  
  constructor(redis: Redis) {
    this.redis = redis
  }
  
  async checkLimit(
    key: string, 
    limit: number, 
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const window = Math.floor(now / windowMs)
    const redisKey = `rate_limit:${key}:${window}`
    
    const current = await this.redis.incr(redisKey)
    
    if (current === 1) {
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000))
    }
    
    const remaining = Math.max(0, limit - current)
    const resetTime = (window + 1) * windowMs
    
    return {
      allowed: current <= limit,
      remaining,
      resetTime
    }
  }
}
```

### 4.2 CORS Security Configuration

```typescript
export const corsConfig = {
  // Production configuration
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL!, process.env.ADMIN_URL!]
    : ['http://localhost:3000', 'http://localhost:3001'],
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token'
  ],
  
  credentials: true,
  
  maxAge: 86400, // 24 hours for preflight cache
  
  // Security headers
  optionsSuccessStatus: 200
}
```

## 5. Data Encryption & Protection

### 5.1 Encryption Strategy

```typescript
// Data encryption utilities
export class EncryptionService {
  private algorithm = 'aes-256-gcm'
  private keyDerivation = 'pbkdf2'
  
  // Encrypt sensitive data
  async encrypt(data: string, key: string): Promise<string> {
    const salt = crypto.randomBytes(16)
    const iv = crypto.randomBytes(16)
    
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256')
    
    const cipher = crypto.createCipher(this.algorithm, derivedKey, iv)
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
  
  // Decrypt sensitive data
  async decrypt(encryptedData: string, key: string): Promise<string> {
    const [saltHex, ivHex, authTagHex, encrypted] = encryptedData.split(':')
    
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256')
    
    const decipher = crypto.createDecipher(this.algorithm, derivedKey, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}

// Database field encryption
export const encryptedFields = {
  // User data
  personalInfo: ['phone', 'address', 'taxId'],
  
  // Payment data (minimal - most handled by Stripe)
  paymentMethods: ['last4', 'brand'], // Only metadata
  
  // Audit logs
  auditData: ['ipAddress', 'userAgent', 'details']
}
```

### 5.2 Secure File Upload & Storage

```typescript
export class SecureFileUpload {
  private allowedTypes = [
    'image/jpeg',
    'image/png', 
    'image/webp',
    'application/pdf',
    'text/plain'
  ]
  
  private maxFileSize = 10 * 1024 * 1024 // 10MB
  private uploadDir = process.env.UPLOAD_DIR || '/tmp/uploads'
  
  async validateFile(file: File): Promise<ValidationResult> {
    // File type validation
    if (!this.allowedTypes.includes(file.type)) {
      return { valid: false, error: 'File type not allowed' }
    }
    
    // File size validation
    if (file.size > this.maxFileSize) {
      return { valid: false, error: 'File too large' }
    }
    
    // File content validation (magic number check)
    const buffer = await file.arrayBuffer()
    const isValidType = await this.validateFileHeader(buffer, file.type)
    
    if (!isValidType) {
      return { valid: false, error: 'File content does not match extension' }
    }
    
    // Malware scanning (integrate with service like ClamAV)
    const isSafe = await this.scanForMalware(buffer)
    if (!isSafe) {
      return { valid: false, error: 'File failed security scan' }
    }
    
    return { valid: true }
  }
  
  async secureUpload(file: File, userId: string): Promise<string> {
    const validation = await this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    
    // Generate secure filename
    const ext = path.extname(file.name)
    const filename = `${userId}_${crypto.randomUUID()}${ext}`
    const filepath = path.join(this.uploadDir, filename)
    
    // Save with restricted permissions
    await fs.writeFile(filepath, Buffer.from(await file.arrayBuffer()), {
      mode: 0o644
    })
    
    // Generate signed URL for access
    return this.generateSignedUrl(filename)
  }
  
  private async validateFileHeader(buffer: ArrayBuffer, mimeType: string): Promise<boolean> {
    const bytes = new Uint8Array(buffer.slice(0, 4))
    
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'application/pdf': [0x25, 0x50, 0x44, 0x46]
    }
    
    const signature = signatures[mimeType as keyof typeof signatures]
    if (!signature) return false
    
    return signature.every((byte, index) => bytes[index] === byte)
  }
}
```

## 6. Audit Logging & Monitoring

### 6.1 Security Event Logging

```typescript
export class SecurityAuditLogger {
  private logLevel = process.env.LOG_LEVEL || 'info'
  
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      severity: event.severity,
      userId: event.userId,
      ipAddress: this.hashIP(event.ipAddress),
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      result: event.result,
      details: event.details,
      sessionId: event.sessionId
    }
    
    // Log to database for compliance
    await this.saveToDatabase(logEntry)
    
    // Log to monitoring service
    await this.sendToMonitoring(logEntry)
    
    // Alert on critical events
    if (event.severity === 'critical') {
      await this.sendAlert(logEntry)
    }
  }
  
  // Hash IP addresses for privacy compliance
  private hashIP(ip: string): string {
    return crypto.createHash('sha256')
      .update(ip + process.env.IP_SALT!)
      .digest('hex')
      .substring(0, 16)
  }
}

// Security event types
export const securityEvents = {
  authentication: {
    login_success: 'info',
    login_failure: 'warning',
    password_reset: 'info',
    account_lockout: 'warning',
    mfa_enabled: 'info',
    mfa_disabled: 'warning'
  },
  
  authorization: {
    permission_denied: 'warning',
    role_escalation_attempt: 'critical',
    admin_access: 'info'
  },
  
  payment: {
    payment_success: 'info',
    payment_failure: 'warning',
    suspicious_payment: 'critical',
    refund_processed: 'info'
  },
  
  data: {
    data_export: 'info',
    data_deletion: 'warning',
    encryption_failure: 'critical',
    backup_completed: 'info'
  }
}
```

### 6.2 Real-time Security Monitoring

```typescript
export class SecurityMonitor {
  private redis: Redis
  private alertThresholds = {
    failedLogins: { count: 10, window: 300 }, // 10 in 5 minutes
    paymentFailures: { count: 5, window: 60 }, // 5 in 1 minute
    rateLimitHits: { count: 100, window: 300 }, // 100 in 5 minutes
    adminAccess: { count: 50, window: 3600 } // 50 in 1 hour
  }
  
  async checkSecurityThreshold(
    eventType: string, 
    identifier: string
  ): Promise<boolean> {
    const threshold = this.alertThresholds[eventType as keyof typeof this.alertThresholds]
    if (!threshold) return false
    
    const key = `security:${eventType}:${identifier}`
    const count = await this.redis.incr(key)
    
    if (count === 1) {
      await this.redis.expire(key, threshold.window)
    }
    
    if (count >= threshold.count) {
      await this.triggerSecurityAlert(eventType, identifier, count)
      return true
    }
    
    return false
  }
  
  private async triggerSecurityAlert(
    eventType: string, 
    identifier: string, 
    count: number
  ): Promise<void> {
    const alert = {
      type: 'security_threshold_exceeded',
      eventType,
      identifier,
      count,
      timestamp: new Date().toISOString(),
      severity: 'high'
    }
    
    // Send to monitoring service
    // Send email/Slack notification to security team
    // Potentially trigger automated responses
  }
}
```

This comprehensive security architecture ensures that the NextJS Stripe Payment Template maintains the highest security standards while complying with PCI DSS requirements and Canadian privacy regulations.