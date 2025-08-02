/**
 * Payment Error Handling and Retry Logic
 * Comprehensive error classification and recovery strategies for payment processing
 * Production-ready implementation with proper logging and monitoring
 */

import Stripe from 'stripe';

export enum PaymentErrorType {
  // Card Errors
  CARD_DECLINED = 'card_declined',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  EXPIRED_CARD = 'expired_card',
  INCORRECT_CVC = 'incorrect_cvc',
  INCORRECT_NUMBER = 'incorrect_number',
  INVALID_EXPIRY_MONTH = 'invalid_expiry_month',
  INVALID_EXPIRY_YEAR = 'invalid_expiry_year',
  
  // Processing Errors
  PROCESSING_ERROR = 'processing_error',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  
  // Business Logic Errors
  INVENTORY_ERROR = 'inventory_error',
  TAX_CALCULATION_ERROR = 'tax_calculation_error',
  PROMO_CODE_ERROR = 'promo_code_error',
  
  // Subscription Errors
  SUBSCRIPTION_ERROR = 'subscription_error',
  INVOICE_ERROR = 'invoice_error',
  
  // System Errors
  DATABASE_ERROR = 'database_error',
  WEBHOOK_ERROR = 'webhook_error',
  VALIDATION_ERROR = 'validation_error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface PaymentError {
  type: PaymentErrorType;
  code: string;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  retryable: boolean;
  retryDelay?: number; // milliseconds
  maxRetries?: number;
  suggestedAction: string;
  metadata?: Record<string, any>;
  originalError?: Error | Stripe.errors.StripeError;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: PaymentError;
  attempts: number;
  totalDuration: number;
}

/**
 * Default retry configurations for different error types
 */
export const RETRY_CONFIGS: Record<PaymentErrorType, RetryConfig> = {
  [PaymentErrorType.CARD_DECLINED]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.INSUFFICIENT_FUNDS]: {
    maxAttempts: 3,
    baseDelayMs: 86400000, // 24 hours
    maxDelayMs: 604800000, // 7 days
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.EXPIRED_CARD]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.INCORRECT_CVC]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.PROCESSING_ERROR]: {
    maxAttempts: 3,
    baseDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.AUTHENTICATION_REQUIRED]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.NETWORK_ERROR]: {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.API_ERROR]: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.INVENTORY_ERROR]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.TAX_CALCULATION_ERROR]: {
    maxAttempts: 2,
    baseDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterEnabled: false
  },
  [PaymentErrorType.PROMO_CODE_ERROR]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.SUBSCRIPTION_ERROR]: {
    maxAttempts: 3,
    baseDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.INVOICE_ERROR]: {
    maxAttempts: 3,
    baseDelayMs: 10000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.DATABASE_ERROR]: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.WEBHOOK_ERROR]: {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 120000,
    backoffMultiplier: 2,
    jitterEnabled: true
  },
  [PaymentErrorType.VALIDATION_ERROR]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.INCORRECT_NUMBER]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.INVALID_EXPIRY_MONTH]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  },
  [PaymentErrorType.INVALID_EXPIRY_YEAR]: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterEnabled: false
  }
};

/**
 * Error recovery strategies with user-friendly messages
 */
export const ERROR_RECOVERY_STRATEGIES: Record<PaymentErrorType, PaymentError> = {
  [PaymentErrorType.CARD_DECLINED]: {
    type: PaymentErrorType.CARD_DECLINED,
    code: 'CARD_DECLINED',
    message: 'Your card was declined by your bank',
    userMessage: 'Your card was declined. Please try a different payment method or contact your bank.',
    severity: ErrorSeverity.MEDIUM,
    retryable: false,
    suggestedAction: 'UPDATE_PAYMENT_METHOD',
    metadata: {
      showAlternativePaymentMethods: true,
      contactBankSuggestion: true
    }
  },
  [PaymentErrorType.INSUFFICIENT_FUNDS]: {
    type: PaymentErrorType.INSUFFICIENT_FUNDS,
    code: 'INSUFFICIENT_FUNDS',
    message: 'Insufficient funds on the card',
    userMessage: 'Insufficient funds. Please use a different card or add funds to your account.',
    severity: ErrorSeverity.MEDIUM,
    retryable: true,
    retryDelay: 86400000, // 24 hours
    maxRetries: 3,
    suggestedAction: 'RETRY_LATER_OR_NEW_CARD',
    metadata: {
      showAlternativePaymentMethods: true,
      suggestRetryLater: true
    }
  },
  [PaymentErrorType.EXPIRED_CARD]: {
    type: PaymentErrorType.EXPIRED_CARD,
    code: 'EXPIRED_CARD',
    message: 'Your card has expired',
    userMessage: 'Your card has expired. Please use a different payment method.',
    severity: ErrorSeverity.MEDIUM,
    retryable: false,
    suggestedAction: 'UPDATE_PAYMENT_METHOD',
    metadata: {
      showAlternativePaymentMethods: true
    }
  },
  [PaymentErrorType.INCORRECT_CVC]: {
    type: PaymentErrorType.INCORRECT_CVC,
    code: 'INCORRECT_CVC',
    message: 'Your card\'s security code is incorrect',
    userMessage: 'Your card\'s security code is incorrect. Please check and try again.',
    severity: ErrorSeverity.LOW,
    retryable: false,
    suggestedAction: 'CORRECT_CVC',
    metadata: {
      focusField: 'cvc'
    }
  },
  [PaymentErrorType.INCORRECT_NUMBER]: {
    type: PaymentErrorType.INCORRECT_NUMBER,
    code: 'INCORRECT_NUMBER',
    message: 'Your card number is incorrect',
    userMessage: 'Your card number is incorrect. Please check and try again.',
    severity: ErrorSeverity.LOW,
    retryable: false,
    suggestedAction: 'CORRECT_CARD_NUMBER',
    metadata: {
      focusField: 'cardNumber'
    }
  },
  [PaymentErrorType.INVALID_EXPIRY_MONTH]: {
    type: PaymentErrorType.INVALID_EXPIRY_MONTH,
    code: 'INVALID_EXPIRY_MONTH',
    message: 'Your card\'s expiration month is invalid',
    userMessage: 'Your card\'s expiration month is invalid. Please check and try again.',
    severity: ErrorSeverity.LOW,
    retryable: false,
    suggestedAction: 'CORRECT_EXPIRY',
    metadata: {
      focusField: 'expiryMonth'
    }
  },
  [PaymentErrorType.INVALID_EXPIRY_YEAR]: {
    type: PaymentErrorType.INVALID_EXPIRY_YEAR,
    code: 'INVALID_EXPIRY_YEAR',
    message: 'Your card\'s expiration year is invalid',
    userMessage: 'Your card\'s expiration year is invalid. Please check and try again.',
    severity: ErrorSeverity.LOW,
    retryable: false,
    suggestedAction: 'CORRECT_EXPIRY',
    metadata: {
      focusField: 'expiryYear'
    }
  },
  [PaymentErrorType.PROCESSING_ERROR]: {
    type: PaymentErrorType.PROCESSING_ERROR,
    code: 'PROCESSING_ERROR',
    message: 'Payment processing error',
    userMessage: 'There was an error processing your payment. Please try again.',
    severity: ErrorSeverity.HIGH,
    retryable: true,
    retryDelay: 5000,
    maxRetries: 3,
    suggestedAction: 'RETRY_PAYMENT'
  },
  [PaymentErrorType.AUTHENTICATION_REQUIRED]: {
    type: PaymentErrorType.AUTHENTICATION_REQUIRED,
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Additional authentication required',
    userMessage: 'Your bank requires additional authentication to complete this payment.',
    severity: ErrorSeverity.MEDIUM,
    retryable: true,
    suggestedAction: 'COMPLETE_AUTHENTICATION',
    metadata: {
      requiresUserAction: true
    }
  },
  [PaymentErrorType.NETWORK_ERROR]: {
    type: PaymentErrorType.NETWORK_ERROR,
    code: 'NETWORK_ERROR',
    message: 'Network connectivity issue',
    userMessage: 'Network error. Please check your connection and try again.',
    severity: ErrorSeverity.MEDIUM,
    retryable: true,
    retryDelay: 1000,
    maxRetries: 5,
    suggestedAction: 'CHECK_CONNECTION_AND_RETRY'
  },
  [PaymentErrorType.API_ERROR]: {
    type: PaymentErrorType.API_ERROR,
    code: 'API_ERROR',
    message: 'Payment service temporarily unavailable',
    userMessage: 'Payment service is temporarily unavailable. Please try again in a few moments.',
    severity: ErrorSeverity.HIGH,
    retryable: true,
    retryDelay: 2000,
    maxRetries: 3,
    suggestedAction: 'RETRY_SHORTLY'
  },
  [PaymentErrorType.INVENTORY_ERROR]: {
    type: PaymentErrorType.INVENTORY_ERROR,
    code: 'INVENTORY_ERROR',
    message: 'Product is no longer available',
    userMessage: 'This product is no longer available. Please remove it from your cart.',
    severity: ErrorSeverity.MEDIUM,
    retryable: false,
    suggestedAction: 'REMOVE_FROM_CART',
    metadata: {
      requiresCartUpdate: true
    }
  },
  [PaymentErrorType.TAX_CALCULATION_ERROR]: {
    type: PaymentErrorType.TAX_CALCULATION_ERROR,
    code: 'TAX_CALCULATION_ERROR',
    message: 'Unable to calculate taxes',
    userMessage: 'Unable to calculate taxes for your location. Please try again or contact support.',
    severity: ErrorSeverity.MEDIUM,
    retryable: true,
    retryDelay: 1000,
    maxRetries: 2,
    suggestedAction: 'RETRY_OR_CONTACT_SUPPORT'
  },
  [PaymentErrorType.PROMO_CODE_ERROR]: {
    type: PaymentErrorType.PROMO_CODE_ERROR,
    code: 'PROMO_CODE_ERROR',
    message: 'Promo code is invalid or expired',
    userMessage: 'The promo code you entered is invalid or has expired.',
    severity: ErrorSeverity.LOW,
    retryable: false,
    suggestedAction: 'REMOVE_PROMO_CODE',
    metadata: {
      clearPromoCode: true
    }
  },
  [PaymentErrorType.SUBSCRIPTION_ERROR]: {
    type: PaymentErrorType.SUBSCRIPTION_ERROR,
    code: 'SUBSCRIPTION_ERROR',
    message: 'Subscription creation failed',
    userMessage: 'Unable to create your subscription. Please try again.',
    severity: ErrorSeverity.HIGH,
    retryable: true,
    retryDelay: 5000,
    maxRetries: 3,
    suggestedAction: 'RETRY_SUBSCRIPTION'
  },
  [PaymentErrorType.INVOICE_ERROR]: {
    type: PaymentErrorType.INVOICE_ERROR,
    code: 'INVOICE_ERROR',
    message: 'Invoice processing failed',
    userMessage: 'There was an error processing your invoice. We\'ll try again shortly.',
    severity: ErrorSeverity.HIGH,
    retryable: true,
    retryDelay: 10000,
    maxRetries: 3,
    suggestedAction: 'AUTO_RETRY'
  },
  [PaymentErrorType.DATABASE_ERROR]: {
    type: PaymentErrorType.DATABASE_ERROR,
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    userMessage: 'There was a temporary system error. Please try again.',
    severity: ErrorSeverity.CRITICAL,
    retryable: true,
    retryDelay: 1000,
    maxRetries: 3,
    suggestedAction: 'RETRY_SYSTEM'
  },
  [PaymentErrorType.WEBHOOK_ERROR]: {
    type: PaymentErrorType.WEBHOOK_ERROR,
    code: 'WEBHOOK_ERROR',
    message: 'Webhook processing failed',
    userMessage: 'Your payment is being processed. You\'ll receive a confirmation shortly.',
    severity: ErrorSeverity.HIGH,
    retryable: true,
    retryDelay: 2000,
    maxRetries: 5,
    suggestedAction: 'AUTO_RETRY_WEBHOOK'
  },
  [PaymentErrorType.VALIDATION_ERROR]: {
    type: PaymentErrorType.VALIDATION_ERROR,
    code: 'VALIDATION_ERROR',
    message: 'Invalid request data',
    userMessage: 'Please check your information and try again.',
    severity: ErrorSeverity.LOW,
    retryable: false,
    suggestedAction: 'CORRECT_FORM_DATA',
    metadata: {
      requiresFormValidation: true
    }
  }
};

/**
 * Classify Stripe errors into our error types
 */
export function classifyStripeError(error: Stripe.errors.StripeError): PaymentError {
  let errorType: PaymentErrorType;
  
  if (error.type === 'StripeCardError') {
    switch (error.code) {
      case 'card_declined':
        errorType = PaymentErrorType.CARD_DECLINED;
        break;
      case 'insufficient_funds':
        errorType = PaymentErrorType.INSUFFICIENT_FUNDS;
        break;
      case 'expired_card':
        errorType = PaymentErrorType.EXPIRED_CARD;
        break;
      case 'incorrect_cvc':
        errorType = PaymentErrorType.INCORRECT_CVC;
        break;
      case 'incorrect_number':
        errorType = PaymentErrorType.INCORRECT_NUMBER;
        break;
      case 'invalid_expiry_month':
        errorType = PaymentErrorType.INVALID_EXPIRY_MONTH;
        break;
      case 'invalid_expiry_year':
        errorType = PaymentErrorType.INVALID_EXPIRY_YEAR;
        break;
      default:
        errorType = PaymentErrorType.CARD_DECLINED;
    }
  } else if (error.type === 'StripeRateLimitError') {
    errorType = PaymentErrorType.API_ERROR;
  } else if (error.type === 'StripeConnectionError') {
    errorType = PaymentErrorType.NETWORK_ERROR;
  } else if (error.type === 'StripeAPIError') {
    errorType = PaymentErrorType.API_ERROR;
  } else if (error.type === 'StripeAuthenticationError') {
    errorType = PaymentErrorType.API_ERROR;
  } else if (error.type === 'StripePermissionError') {
    errorType = PaymentErrorType.API_ERROR;
  } else {
    errorType = PaymentErrorType.PROCESSING_ERROR;
  }

  const baseError = ERROR_RECOVERY_STRATEGIES[errorType];
  
  return {
    ...baseError,
    message: error.message || baseError.message,
    originalError: error,
    metadata: {
      ...baseError.metadata,
      stripeErrorType: error.type,
      stripeErrorCode: error.code,
      requestId: error.request_id
    }
  };
}

/**
 * Classify general errors into payment error types
 */
export function classifyError(error: Error | unknown): PaymentError {
  if (error instanceof Error) {
    // Check if it's a Stripe error
    if ('type' in error && 'code' in error) {
      return classifyStripeError(error as Stripe.errors.StripeError);
    }

    // Database errors
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('connection') ||
        error.message.includes('timeout')) {
      return {
        ...ERROR_RECOVERY_STRATEGIES[PaymentErrorType.DATABASE_ERROR],
        originalError: error
      };
    }

    // Network errors
    if (error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('ENOTFOUND')) {
      return {
        ...ERROR_RECOVERY_STRATEGIES[PaymentErrorType.NETWORK_ERROR],
        originalError: error
      };
    }

    // Validation errors
    if (error.message.includes('validation') || 
        error.message.includes('invalid') ||
        error.message.includes('required')) {
      return {
        ...ERROR_RECOVERY_STRATEGIES[PaymentErrorType.VALIDATION_ERROR],
        originalError: error
      };
    }

    // Default to processing error
    return {
      ...ERROR_RECOVERY_STRATEGIES[PaymentErrorType.PROCESSING_ERROR],
      message: error.message,
      originalError: error
    };
  }

  // Unknown error type
  return {
    ...ERROR_RECOVERY_STRATEGIES[PaymentErrorType.PROCESSING_ERROR],
    message: 'An unknown error occurred',
    originalError: error as Error
  };
}

/**
 * Calculate delay for retry with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig
): number {
  if (attempt === 1) return 0;

  let delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 2);
  delay = Math.min(delay, config.maxDelayMs);

  if (config.jitterEnabled) {
    // Add random jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    delay += jitter;
  }

  return Math.max(0, Math.round(delay));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  errorType: PaymentErrorType,
  customConfig?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const config = { ...RETRY_CONFIGS[errorType], ...customConfig };
  const startTime = Date.now();
  let lastError: PaymentError | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        result,
        attempts: attempt,
        totalDuration: Date.now() - startTime
      };
    } catch (error) {
      lastError = classifyError(error);
      
      // Don't retry if error is not retryable
      if (!lastError.retryable) {
        break;
      }

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      const delay = calculateRetryDelay(attempt, config);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`Retry attempt ${attempt} failed, waiting ${delay}ms before next attempt`);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: config.maxAttempts,
    totalDuration: Date.now() - startTime
  };
}

/**
 * Retry payment intent confirmation
 */
export async function retryPaymentIntentConfirmation(
  paymentIntentId: string,
  stripeClient: Stripe
): Promise<RetryResult<Stripe.PaymentIntent>> {
  return retryWithBackoff(
    async () => {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        return paymentIntent;
      }
      
      if (paymentIntent.status === 'requires_payment_method') {
        throw new Error('Payment requires new payment method');
      }
      
      if (paymentIntent.status === 'requires_action') {
        throw new Error('Payment requires customer action');
      }
      
      // Try to confirm if it's in a confirmable state
      if (paymentIntent.status === 'requires_confirmation') {
        return await stripeClient.paymentIntents.confirm(paymentIntentId);
      }
      
      throw new Error(`Payment intent in unexpected state: ${paymentIntent.status}`);
    },
    PaymentErrorType.PROCESSING_ERROR
  );
}

/**
 * Log payment error for monitoring and debugging
 */
export async function logPaymentError(
  error: PaymentError,
  context: {
    userId?: string;
    orderId?: string;
    paymentIntentId?: string;
    subscriptionId?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      type: error.type,
      code: error.code,
      message: error.message,
      severity: error.severity,
      retryable: error.retryable
    },
    context,
    metadata: error.metadata,
    stack: error.originalError?.stack
  };

  // Log to console (in production, use proper logging service)
  console.error('Payment Error:', JSON.stringify(errorLog, null, 2));

  // In production, send to monitoring service
  // await sendToMonitoringService(errorLog);
}

/**
 * Create user-friendly error message based on error type
 */
export function formatErrorForUser(error: PaymentError): {
  title: string;
  message: string;
  action: string;
  showRetry: boolean;
  showAlternativePayment: boolean;
} {
  const config = ERROR_RECOVERY_STRATEGIES[error.type];
  
  return {
    title: getErrorTitle(error.type),
    message: error.userMessage,
    action: config.suggestedAction,
    showRetry: config.retryable,
    showAlternativePayment: config.metadata?.showAlternativePaymentMethods || false
  };
}

/**
 * Get user-friendly error titles
 */
function getErrorTitle(errorType: PaymentErrorType): string {
  const titles: Record<PaymentErrorType, string> = {
    [PaymentErrorType.CARD_DECLINED]: 'Card Declined',
    [PaymentErrorType.INSUFFICIENT_FUNDS]: 'Insufficient Funds',
    [PaymentErrorType.EXPIRED_CARD]: 'Card Expired',
    [PaymentErrorType.INCORRECT_CVC]: 'Incorrect Security Code',
    [PaymentErrorType.INCORRECT_NUMBER]: 'Incorrect Card Number',
    [PaymentErrorType.INVALID_EXPIRY_MONTH]: 'Invalid Expiry Month',
    [PaymentErrorType.INVALID_EXPIRY_YEAR]: 'Invalid Expiry Year',
    [PaymentErrorType.PROCESSING_ERROR]: 'Processing Error',
    [PaymentErrorType.AUTHENTICATION_REQUIRED]: 'Authentication Required',
    [PaymentErrorType.NETWORK_ERROR]: 'Connection Error',
    [PaymentErrorType.API_ERROR]: 'Service Unavailable',
    [PaymentErrorType.INVENTORY_ERROR]: 'Product Unavailable',
    [PaymentErrorType.TAX_CALCULATION_ERROR]: 'Tax Calculation Error',
    [PaymentErrorType.PROMO_CODE_ERROR]: 'Invalid Promo Code',
    [PaymentErrorType.SUBSCRIPTION_ERROR]: 'Subscription Error',
    [PaymentErrorType.INVOICE_ERROR]: 'Invoice Error',
    [PaymentErrorType.DATABASE_ERROR]: 'System Error',
    [PaymentErrorType.WEBHOOK_ERROR]: 'Processing Delay',
    [PaymentErrorType.VALIDATION_ERROR]: 'Invalid Information'
  };

  return titles[errorType] || 'Payment Error';
}

/**
 * Check if error requires immediate user attention
 */
export function requiresUserAction(error: PaymentError): boolean {
  return error.metadata?.requiresUserAction === true ||
         error.type === PaymentErrorType.AUTHENTICATION_REQUIRED ||
         error.type === PaymentErrorType.INCORRECT_CVC ||
         error.type === PaymentErrorType.INCORRECT_NUMBER ||
         error.type === PaymentErrorType.INVALID_EXPIRY_MONTH ||
         error.type === PaymentErrorType.INVALID_EXPIRY_YEAR;
}

export default {
  PaymentErrorType,
  ErrorSeverity,
  RETRY_CONFIGS,
  ERROR_RECOVERY_STRATEGIES,
  classifyStripeError,
  classifyError,
  calculateRetryDelay,
  retryWithBackoff,
  retryPaymentIntentConfirmation,
  logPaymentError,
  formatErrorForUser,
  requiresUserAction
};