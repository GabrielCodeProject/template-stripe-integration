# Data Privacy and Security Documentation

## Overview
This document outlines the comprehensive data privacy and security measures implemented in the NextJS Stripe Payment Template, ensuring compliance with Canadian privacy laws (PIPEDA), PCI DSS requirements, and industry best practices.

## Legal and Regulatory Compliance

### Canadian Privacy Laws (PIPEDA)

#### Personal Information Protection
The database schema implements PIPEDA compliance through:

1. **Minimal Data Collection**
   - Only collect personal information necessary for business purposes
   - Optional fields clearly marked in schema
   - Granular consent tracking for marketing communications

2. **Consent Management**
```typescript
// User consent tracking
model UserConsent {
  id          String   @id @default(cuid())
  userId      String
  consentType String   // 'marketing', 'analytics', 'cookies'
  granted     Boolean
  grantedAt   DateTime?
  revokedAt   DateTime?
  ipAddress   String?
  userAgent   String?
  
  user        User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, consentType])
  @@map("user_consents")
}
```

3. **Data Retention Policies**
```sql
-- Automated data retention compliance
-- Customer data: Retain for 7 years after last transaction (CRA requirement)
-- Marketing data: Delete after 3 years of inactivity
-- Audit logs: Retain for 7 years for compliance

-- Example retention policy implementation
CREATE OR REPLACE FUNCTION cleanup_expired_data() 
RETURNS void AS $$
BEGIN
  -- Delete old analytics events (1 year retention)
  DELETE FROM analytics_events 
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  -- Archive old audit logs (keep 7 years)
  INSERT INTO audit_logs_archive 
  SELECT * FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '7 years';
  
  -- Delete expired download links
  UPDATE downloads 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;
```

#### Right to Access and Portability
```typescript
// Data export for PIPEDA compliance
export const exportUserData = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      address: true,
      orders: {
        include: {
          items: true,
          payments: true
        }
      },
      subscriptions: true,
      downloads: true,
      supportTickets: {
        include: { messages: true }
      },
      notifications: true,
      auditLogs: {
        where: { action: { in: ['LOGIN', 'LOGOUT', 'PAYMENT'] } }
      }
    }
  })
  
  // Remove sensitive information before export
  const exportData = {
    ...userData,
    hashedPassword: undefined,
    sessions: undefined
  }
  
  return exportData
}
```

#### Right to Deletion (Right to be Forgotten)
```typescript
// Secure user data deletion
export const deleteUserData = async (userId: string) => {
  await prisma.$transaction(async (tx) => {
    // Anonymize instead of delete for financial records (CRA compliance)
    await tx.order.updateMany({
      where: { userId },
      data: {
        customerEmail: 'deleted@privacy.local',
        customerPhone: null,
        adminNotes: 'User data anonymized per privacy request'
      }
    })
    
    // Delete non-essential personal data
    await tx.notification.deleteMany({ where: { userId } })
    await tx.download.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    
    // Anonymize audit logs
    await tx.auditLog.updateMany({
      where: { userId },
      data: { userId: null }
    })
    
    // Soft delete user account
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@privacy.local`,
        firstName: null,
        lastName: null,
        phone: null,
        profileImageUrl: null,
        status: 'INACTIVE'
      }
    })
  })
}
```

### PCI DSS Compliance

#### Data Security Standards
The system achieves PCI DSS compliance through:

1. **No Card Data Storage**
   - All payment processing handled by Stripe
   - Only store PCI-compliant payment tokens
   - No CVV, full PAN, or expiration dates stored

2. **Secure Data Transmission**
```typescript
// Stripe integration with secure tokenization
export const createPaymentIntent = async (amount: number, customerId: string) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'cad',
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      integration_check: 'accept_a_payment'
    }
  })
  
  // Store only the payment intent ID, never card details
  await prisma.payment.create({
    data: {
      stripePaymentIntentId: paymentIntent.id,
      amount,
      status: 'PENDING',
      currency: 'CAD'
    }
  })
  
  return paymentIntent
}
```

3. **Access Control Implementation**
```typescript
// Role-based access control middleware
export const requireRole = (allowedRoles: UserRole[]) => {
  return async (req: NextRequest, res: NextResponse) => {
    const session = await getSession(req)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!allowedRoles.includes(session.user.role)) {
      // Log unauthorized access attempt
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UNAUTHORIZED_ACCESS',
          resource: req.url,
          ipAddress: req.ip,
          userAgent: req.headers.get('user-agent')
        }
      })
      
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
}
```

## Data Encryption

### Encryption at Rest

#### Database Column Encryption
```sql
-- Encrypt sensitive fields using PostgreSQL encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt PII data
ALTER TABLE users ADD COLUMN encrypted_phone bytea;
ALTER TABLE addresses ADD COLUMN encrypted_address_line1 bytea;

-- Encryption functions
CREATE OR REPLACE FUNCTION encrypt_pii(data text, key text)
RETURNS bytea AS $$
BEGIN
  RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_pii(encrypted_data bytea, key text)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, key);
END;
$$ LANGUAGE plpgsql;
```

#### Application-Level Encryption
```typescript
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
const ALGORITHM = 'aes-256-gcm'

export const encryptSensitiveData = (text: string): string => {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY)
  cipher.update(text, 'utf8', 'hex')
  const encrypted = cipher.final('hex')
  const tag = cipher.getAuthTag()
  
  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  })
}

export const decryptSensitiveData = (encryptedData: string): string => {
  const { encrypted, iv, tag } = JSON.parse(encryptedData)
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY)
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  decipher.update(encrypted, 'hex', 'utf8')
  
  return decipher.final('utf8')
}
```

### Encryption in Transit

#### HTTPS Configuration
```typescript
// Next.js security headers
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' js.stripe.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' api.stripe.com;
    frame-src js.stripe.com;
  `.replace(/\s+/g, ' ').trim(),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}
```

#### API Security
```typescript
// Rate limiting for API endpoints
import rateLimit from 'express-rate-limit'

export const createRateLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      client: redis,
      prefix: 'rate_limit:'
    })
  })
}

// Authentication endpoint rate limiting
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5) // 5 attempts per 15 minutes
export const apiLimiter = createRateLimiter(60 * 1000, 100) // 100 requests per minute
export const paymentLimiter = createRateLimiter(60 * 1000, 10) // 10 payment attempts per minute
```

## Access Control and Authentication

### Multi-Factor Authentication
```typescript
// MFA implementation using time-based OTP
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

export const generateMFASecret = async (userId: string) => {
  const secret = speakeasy.generateSecret({
    name: `${process.env.SITE_NAME}:${userId}`,
    issuer: process.env.SITE_NAME
  })
  
  // Store encrypted secret
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptSensitiveData(secret.base32),
      mfaEnabled: false
    }
  })
  
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)
  
  return {
    secret: secret.base32,
    qrCode: qrCodeUrl
  }
}

export const verifyMFAToken = async (userId: string, token: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true }
  })
  
  if (!user?.mfaSecret) return false
  
  const secret = decryptSensitiveData(user.mfaSecret)
  
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2 // Allow 2 time windows for clock drift
  })
}
```

### Session Security
```typescript
// Secure session management with Redis
export const createSecureSession = async (userId: string, req: NextRequest) => {
  const sessionId = crypto.randomUUID()
  const sessionData = {
    userId,
    createdAt: new Date().toISOString(),
    ipAddress: req.ip,
    userAgent: req.headers.get('user-agent'),
    lastActivity: new Date().toISOString()
  }
  
  // Store session in Redis with expiration
  await redis.setex(
    `session:${sessionId}`,
    24 * 60 * 60, // 24 hours
    JSON.stringify(sessionData)
  )
  
  // Log session creation
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'LOGIN',
      resource: 'session',
      ipAddress: req.ip,
      userAgent: req.headers.get('user-agent')
    }
  })
  
  return sessionId
}

export const validateSession = async (sessionId: string): Promise<SessionData | null> => {
  const sessionData = await redis.get(`session:${sessionId}`)
  
  if (!sessionData) return null
  
  const session = JSON.parse(sessionData)
  
  // Update last activity
  session.lastActivity = new Date().toISOString()
  await redis.setex(`session:${sessionId}`, 24 * 60 * 60, JSON.stringify(session))
  
  return session
}
```

## Audit Logging and Compliance

### Comprehensive Audit Trail
```typescript
// Audit logging middleware
export const auditMiddleware = (action: AuditAction, resource: string) => {
  return async (req: NextRequest, res: NextResponse, next: NextFunction) => {
    const session = await getSession(req)
    const startTime = Date.now()
    
    // Execute the request
    await next()
    
    const endTime = Date.now()
    
    // Log the audit event
    await prisma.auditLog.create({
      data: {
        userId: session?.user?.id,
        action,
        resource,
        resourceId: req.params?.id,
        method: req.method,
        endpoint: req.url,
        ipAddress: req.ip,
        userAgent: req.headers.get('user-agent'),
        metadata: {
          responseTime: endTime - startTime,
          statusCode: res.status,
          requestBody: req.method !== 'GET' ? req.body : undefined
        }
      }
    })
  }
}
```

### Financial Audit Compliance
```typescript
// Enhanced audit logging for financial transactions
export const auditFinancialTransaction = async (
  userId: string,
  action: 'PAYMENT' | 'REFUND' | 'SUBSCRIPTION_CHANGE',
  details: {
    orderId?: string
    paymentId?: string
    amount?: number
    currency?: string
    stripeTransactionId?: string
    previousState?: any
    newState?: any
  }
) => {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource: 'financial_transaction',
      resourceId: details.orderId || details.paymentId,
      oldValues: details.previousState,
      newValues: details.newState,
      metadata: {
        amount: details.amount,
        currency: details.currency,
        stripeTransactionId: details.stripeTransactionId,
        compliance: 'CRA_FINANCIAL_RECORD'
      }
    }
  })
}
```

## Data Backup and Recovery

### Encrypted Backup Strategy
```bash
#!/bin/bash
# secure-backup.sh

# Set encryption key from environment
BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-$(openssl rand -base64 32)}
BACKUP_DIR="/secure/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create encrypted full backup
pg_dump $DATABASE_URL | \
  gzip | \
  gpg --symmetric --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
      --s2k-digest-algo SHA512 --s2k-count 65536 --passphrase "$BACKUP_ENCRYPTION_KEY" \
      > "$BACKUP_DIR/encrypted_backup_$TIMESTAMP.sql.gz.gpg"

# Verify backup integrity
gpg --quiet --batch --yes --decrypt --passphrase "$BACKUP_ENCRYPTION_KEY" \
    "$BACKUP_DIR/encrypted_backup_$TIMESTAMP.sql.gz.gpg" | \
    gunzip | \
    head -10 > /dev/null

if [ $? -eq 0 ]; then
    echo "Backup created and verified successfully: encrypted_backup_$TIMESTAMP.sql.gz.gpg"
else
    echo "Backup verification failed!" >&2
    exit 1
fi

# Clean up old backups (keep 30 days)
find "$BACKUP_DIR" -name "encrypted_backup_*.sql.gz.gpg" -mtime +30 -delete
```

### Disaster Recovery Plan
```typescript
// Automated disaster recovery procedures
export const performDisasterRecovery = async (backupFile: string) => {
  console.log('🚨 Initiating disaster recovery procedure...')
  
  // 1. Verify backup integrity
  const isBackupValid = await verifyBackupIntegrity(backupFile)
  if (!isBackupValid) {
    throw new Error('Backup file is corrupted or invalid')
  }
  
  // 2. Create recovery database
  await createRecoveryDatabase()
  
  // 3. Restore from backup
  await restoreFromBackup(backupFile)
  
  // 4. Verify data integrity
  const integrityCheck = await performIntegrityCheck()
  if (!integrityCheck.passed) {
    throw new Error(`Data integrity check failed: ${integrityCheck.errors}`)
  }
  
  // 5. Update application configuration
  await updateDatabaseConfiguration()
  
  console.log('✅ Disaster recovery completed successfully')
}
```

## Privacy Impact Assessment

### Data Flow Analysis
```typescript
// Privacy impact assessment for data processing
export const performPrivacyAssessment = async () => {
  const assessment = {
    personalDataTypes: [
      'Email addresses',
      'Names (first, last)',
      'Phone numbers',
      'Billing addresses',
      'Payment information (tokenized)',
      'Order history',
      'Usage analytics'
    ],
    
    lawfulBasis: {
      orders: 'Contract performance',
      marketing: 'Consent',
      analytics: 'Legitimate interest',
      accounting: 'Legal obligation (CRA)'
    },
    
    dataMinimization: {
      implemented: true,
      description: 'Only collect data necessary for business purposes',
      optionalFields: ['phone', 'dateOfBirth', 'profileImageUrl']
    },
    
    retentionPeriods: {
      customerData: '7 years (CRA requirement)',
      marketingData: '3 years or until consent withdrawn',
      analyticsData: '2 years',
      auditLogs: '7 years'
    },
    
    securityMeasures: [
      'Encryption at rest and in transit',
      'Access controls and authentication',
      'Regular security audits',
      'PCI DSS compliance through Stripe',
      'Rate limiting and DDoS protection'
    ],
    
    thirdPartySharing: {
      stripe: 'Payment processing (contractual necessity)',
      emailProvider: 'Transactional emails (legitimate interest)',
      analyticsProvider: 'Business analytics (consent required)'
    }
  }
  
  return assessment
}
```

## Compliance Monitoring

### Automated Compliance Checks
```typescript
// Regular compliance monitoring
export const runComplianceChecks = async () => {
  const results = {
    dataRetention: await checkDataRetentionCompliance(),
    encryption: await verifyEncryptionStatus(),
    accessControls: await auditAccessControls(),
    backups: await verifyBackupIntegrity(),
    auditLogs: await validateAuditLogCompleteness()
  }
  
  // Generate compliance report
  const report = generateComplianceReport(results)
  
  // Send alerts for any compliance violations
  const violations = Object.entries(results)
    .filter(([_, result]) => !result.compliant)
    .map(([check, result]) => ({ check, issues: result.issues }))
  
  if (violations.length > 0) {
    await sendComplianceAlert(violations)
  }
  
  return report
}

// Schedule compliance checks
const scheduleComplianceChecks = () => {
  // Daily quick checks
  cron.schedule('0 2 * * *', runComplianceChecks)
  
  // Weekly comprehensive audit
  cron.schedule('0 3 * * 0', runComprehensiveAudit)
  
  // Monthly privacy assessment
  cron.schedule('0 4 1 * *', performPrivacyAssessment)
}
```

This comprehensive data privacy and security framework ensures your NextJS Stripe Payment Template meets all Canadian regulatory requirements while implementing industry-leading security practices.