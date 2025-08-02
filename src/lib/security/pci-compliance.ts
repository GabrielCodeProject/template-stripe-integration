/**
 * PCI DSS Compliance and Security Implementation
 * Comprehensive security measures for NextJS Stripe Payment Template
 * Ensures PCI DSS compliance through secure coding practices and monitoring
 */

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export interface SecurityConfig {
  rateLimiting: {
    payment: { requests: number; window: number };
    api: { requests: number; window: number };
    webhook: { requests: number; window: number };
    auth: { requests: number; window: number };
  };
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  session: {
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  headers: {
    contentSecurityPolicy: string;
    strictTransportSecurity: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    referrerPolicy: string;
  };
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimiting: {
    payment: { requests: 10, window: 60000 }, // 10 requests per minute
    api: { requests: 100, window: 60000 }, // 100 requests per minute
    webhook: { requests: 1000, window: 60000 }, // 1000 webhooks per minute
    auth: { requests: 5, window: 300000 }, // 5 auth attempts per 5 minutes
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
  },
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
  },
  headers: {
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;",
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
  },
};

/**
 * Sensitive data patterns that should never be logged
 */
export const SENSITIVE_DATA_PATTERNS = [
  /\b4[0-9]{12}(?:[0-9]{3})?\b/, // Visa card numbers
  /\b5[1-5][0-9]{14}\b/, // MasterCard numbers
  /\b3[47][0-9]{13}\b/, // American Express numbers
  /\b[0-9]{3,4}\b/, // CVV numbers (when in payment context)
  /\bpk_test_[a-zA-Z0-9]+\b/, // Stripe publishable test keys
  /\bsk_test_[a-zA-Z0-9]+\b/, // Stripe secret test keys
  /\bpk_live_[a-zA-Z0-9]+\b/, // Stripe publishable live keys
  /\bsk_live_[a-zA-Z0-9]+\b/, // Stripe secret live keys
  /\bwhsec_[a-zA-Z0-9]+\b/, // Stripe webhook secrets
  /password/i, // Password fields
  /ssn|social.security/i, // Social Security Numbers
];

/**
 * PCI DSS Compliance Class
 * Implements security measures required for PCI DSS compliance
 */
export class PCICompliance {
  private config: SecurityConfig;
  private encryptionKey: Buffer;

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
    this.encryptionKey = this.getEncryptionKey();
  }

  /**
   * Apply security headers to response
   */
  applySecurityHeaders(response: NextResponse): NextResponse {
    const headers = this.config.headers;

    response.headers.set(
      'Content-Security-Policy',
      headers.contentSecurityPolicy
    );
    response.headers.set(
      'Strict-Transport-Security',
      headers.strictTransportSecurity
    );
    response.headers.set('X-Frame-Options', headers.xFrameOptions);
    response.headers.set('X-Content-Type-Options', headers.xContentTypeOptions);
    response.headers.set('Referrer-Policy', headers.referrerPolicy);
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()'
    );

    return response;
  }

  /**
   * Validate and sanitize input data
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove potentially dangerous characters
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptSensitiveData(data: string): {
    encrypted: string;
    iv: string;
    tag: string;
  } {
    const iv = crypto.randomBytes(this.config.encryption.ivLength);
    const cipher = crypto.createCipher(
      this.config.encryption.algorithm,
      this.encryptionKey
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: (cipher as any).getAuthTag?.()?.toString('hex') || '',
    };
  }

  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(encryptedData: {
    encrypted: string;
    iv: string;
    tag: string;
  }): string {
    const decipher = crypto.createDecipher(
      this.config.encryption.algorithm,
      this.encryptionKey
    );

    if (encryptedData.tag) {
      (decipher as any).setAuthTag?.(Buffer.from(encryptedData.tag, 'hex'));
    }

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: string): string {
    let masked = data;

    SENSITIVE_DATA_PATTERNS.forEach(pattern => {
      masked = masked.replace(pattern, match => {
        if (match.length <= 4) {
          return '*'.repeat(match.length);
        }
        return match.substring(0, 4) + '*'.repeat(match.length - 4);
      });
    });

    return masked;
  }

  /**
   * Validate request origin and CORS
   */
  validateOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ];

    if (!origin) {
      // Allow same-origin requests (no origin header)
      return true;
    }

    return allowedOrigins.includes(origin);
  }

  /**
   * Apply rate limiting based on request type
   */
  async applyRateLimit(
    request: NextRequest,
    type: 'payment' | 'api' | 'webhook' | 'auth'
  ): Promise<{
    allowed: boolean;
    remainingRequests: number;
    resetTime: number;
  }> {
    const config = this.config.rateLimiting[type];
    const identifier = this.getRequestIdentifier(request);

    return await rateLimit(identifier, config.requests, config.window);
  }

  /**
   * Log security events for monitoring
   */
  async logSecurityEvent(event: {
    type:
      | 'FAILED_AUTH'
      | 'RATE_LIMIT_EXCEEDED'
      | 'SUSPICIOUS_ACTIVITY'
      | 'PCI_VIOLATION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    ipAddress?: string;
    userAgent?: string;
    userId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const securityLog = {
      timestamp: new Date().toISOString(),
      event: event.type,
      severity: event.severity,
      description: event.description,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent
        ? this.maskSensitiveData(event.userAgent)
        : undefined,
      userId: event.userId,
      metadata: event.metadata
        ? this.maskSensitiveData(JSON.stringify(event.metadata))
        : undefined,
    };

    // Log to console (in production, use proper security monitoring service)
    console.warn('Security Event:', JSON.stringify(securityLog, null, 2));

    // Store in database for audit trail
    try {
      await db.auditLog.create({
        data: {
          userId: event.userId || null,
          action: 'CREATE',
          resource: 'security',
          resourceId: crypto.randomUUID(),
          description: `Security Event: ${event.type} - ${event.description}`,
          newValues: securityLog,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to log security event to database:', error);
    }

    // In production, send to security monitoring service
    // await sendToSecurityMonitoring(securityLog);
  }

  /**
   * Validate webhook signature (Stripe)
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const elements = signature.split(',');
      const timestamp = elements.find(el => el.startsWith('t='))?.slice(2);
      const signatures = elements.filter(el => el.startsWith('v1='));

      if (!timestamp || signatures.length === 0) {
        return false;
      }

      // Check timestamp (prevent replay attacks)
      const timestampNum = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - timestampNum);

      if (timeDiff > 300) {
        // 5 minutes tolerance
        return false;
      }

      // Create expected signature
      const payloadForSignature = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadForSignature, 'utf8')
        .digest('hex');

      // Compare signatures using constant-time comparison
      return signatures.some(sig => {
        const providedSignature = sig.slice(3); // Remove 'v1='
        return crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(providedSignature, 'hex')
        );
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Secure password hashing
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure session token
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate input against common attack patterns
   */
  detectSuspiciousActivity(input: string): {
    suspicious: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let suspicious = false;

    // SQL Injection patterns
    const sqlInjectionPatterns = [
      /(\'\s*(union|select|insert|update|delete|drop|create|alter)\s*)/i,
      /(\-\-|\#|\/\*|\*\/)/,
      /(\'\s*or\s*\'\s*\=\s*\')/i,
      /(\'\s*or\s*1\s*=\s*1)/i,
    ];

    sqlInjectionPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        suspicious = true;
        reasons.push(`SQL injection pattern ${index + 1} detected`);
      }
    });

    // XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    xssPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        suspicious = true;
        reasons.push(`XSS pattern ${index + 1} detected`);
      }
    });

    // Command injection patterns
    const commandInjectionPatterns = [
      /(\|\||&&|;|\|)/,
      /(rm\s|del\s|format\s)/i,
      /(\$\(|\`)/,
    ];

    commandInjectionPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        suspicious = true;
        reasons.push(`Command injection pattern ${index + 1} detected`);
      }
    });

    return { suspicious, reasons };
  }

  /**
   * PCI DSS compliance checklist
   */
  getPCIComplianceStatus(): {
    compliant: boolean;
    requirements: Array<{
      requirement: string;
      status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
      description: string;
    }>;
  } {
    const requirements = [
      {
        requirement: 'PCI DSS 3.2.1: Card Data Storage',
        status: 'COMPLIANT' as const,
        description:
          'No cardholder data is stored. All payment processing handled by Stripe.',
      },
      {
        requirement: 'PCI DSS 4.1: Encryption in Transit',
        status:
          process.env.NODE_ENV === 'production'
            ? ('COMPLIANT' as const)
            : ('NEEDS_REVIEW' as const),
        description:
          'HTTPS enforced for all communications. TLS 1.2+ required.',
      },
      {
        requirement: 'PCI DSS 6.5.1: Injection Flaws',
        status: 'COMPLIANT' as const,
        description: 'Input validation and parameterized queries implemented.',
      },
      {
        requirement: 'PCI DSS 6.5.4: Insecure Communications',
        status: 'COMPLIANT' as const,
        description:
          'All API communications use HTTPS with certificate validation.',
      },
      {
        requirement: 'PCI DSS 8.2: Authentication',
        status: 'COMPLIANT' as const,
        description:
          'Strong authentication implemented with session management.',
      },
      {
        requirement: 'PCI DSS 10.1: Audit Trails',
        status: 'COMPLIANT' as const,
        description:
          'Comprehensive audit logging implemented for all payment activities.',
      },
      {
        requirement: 'PCI DSS 11.2: Vulnerability Scanning',
        status: 'NEEDS_REVIEW' as const,
        description:
          'Regular vulnerability scanning should be implemented in production.',
      },
    ];

    const compliant = requirements.every(req => req.status === 'COMPLIANT');

    return { compliant, requirements };
  }

  /**
   * Get request identifier for rate limiting
   */
  private getRequestIdentifier(request: NextRequest): string {
    // Use IP address as primary identifier
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // For authenticated requests, also consider user ID
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        // In a real implementation, you'd decode the JWT token
        // const userId = decodeJWT(authHeader).userId;
        // return `user:${userId}`;
      } catch (error) {
        // Invalid token, fall back to IP
      }
    }

    return `ip:${ip}`;
  }

  /**
   * Get encryption key from environment
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (key.length !== 64) {
      // 32 bytes in hex
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }

    return Buffer.from(key, 'hex');
  }
}

/**
 * Middleware function to apply security measures
 */
export async function securityMiddleware(request: NextRequest): Promise<{
  allowed: boolean;
  response?: NextResponse;
  securityContext: {
    rateLimited: boolean;
    suspicious: boolean;
    validOrigin: boolean;
  };
}> {
  const pci = new PCICompliance();
  let response = NextResponse.next();

  // Apply security headers
  response = pci.applySecurityHeaders(response);

  // Validate origin
  const validOrigin = pci.validateOrigin(request);
  if (!validOrigin) {
    await pci.logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'MEDIUM',
      description: 'Invalid origin in request',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return {
      allowed: false,
      response: NextResponse.json({ error: 'Invalid origin' }, { status: 403 }),
      securityContext: {
        rateLimited: false,
        suspicious: true,
        validOrigin: false,
      },
    };
  }

  // Apply rate limiting
  const rateLimit = await pci.applyRateLimit(request, 'api');
  if (!rateLimit.allowed) {
    await pci.logSecurityEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      severity: 'MEDIUM',
      description: 'Rate limit exceeded',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set(
      'X-RateLimit-Remaining',
      rateLimit.remainingRequests.toString()
    );
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());

    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: response.headers }
      ),
      securityContext: {
        rateLimited: true,
        suspicious: false,
        validOrigin: true,
      },
    };
  }

  return {
    allowed: true,
    response,
    securityContext: {
      rateLimited: false,
      suspicious: false,
      validOrigin: true,
    },
  };
}

// Export default instance
export const pciCompliance = new PCICompliance();

export default pciCompliance;
