/**
 * Subscription Management System
 * Comprehensive subscription lifecycle management for NextJS Stripe Payment Template
 * Handles creation, updates, cancellations, and billing portal integration
 */

import Stripe from 'stripe';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';
import { calculateCanadianTax } from '@/lib/tax/canadian-tax';
import { 
  SubscriptionStatus, 
  CanadianProvince, 
  AuditAction,
  NotificationType 
} from '@prisma/client';

export interface CreateSubscriptionRequest {
  userId: string;
  planId: string;
  paymentMethodId: string;
  promoCode?: string;
  trialDays?: number;
  billingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    province: CanadianProvince;
    postalCode: string;
    country: string;
  };
  metadata?: Record<string, string>;
}

export interface UpdateSubscriptionRequest {
  subscriptionId: string;
  newPlanId?: string;
  quantity?: number;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
  billingCycleAnchor?: 'now' | 'unchanged';
}

export interface CancelSubscriptionRequest {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  cancellationReason?: string;
  feedback?: string;
  prorationBehavior?: 'create_prorations' | 'none';
}

export interface SubscriptionPreview {
  subtotal: number;
  taxAmount: number;
  total: number;
  prorationAmount?: number;
  immediateCharge: number;
  nextInvoiceAmount: number;
  nextInvoiceDate: Date;
  taxBreakdown: any;
}

export interface DunningSettings {
  maxRetryAttempts: number;
  retrySchedule: number[]; // Days between retries
  gracePeriodDays: number;
  sendEmailNotifications: boolean;
  pauseSubscriptionOnFailure: boolean;
}

/**
 * Default dunning configuration for failed payments
 */
export const DEFAULT_DUNNING_CONFIG: DunningSettings = {
  maxRetryAttempts: 3,
  retrySchedule: [3, 5, 7], // Retry after 3, 5, and 7 days
  gracePeriodDays: 7,
  sendEmailNotifications: true,
  pauseSubscriptionOnFailure: false
};

/**
 * Subscription Manager Class
 * Handles all subscription operations with proper error handling and logging
 */
export class SubscriptionManager {
  private stripe: Stripe;

  constructor(stripeClient: Stripe) {
    this.stripe = stripeClient;
  }

  /**
   * Create a new subscription with proper tax calculation and validation
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<{
    subscription: any;
    customer: any;
    setupIntent?: Stripe.SetupIntent;
  }> {
    // Validate plan exists and is active
    const plan = await db.subscriptionPlan.findFirst({
      where: { 
        id: request.planId,
        isActive: true 
      },
      include: { product: true }
    });

    if (!plan) {
      throw new Error('Subscription plan not found or inactive');
    }

    // Get or create user
    const user = await db.user.findUnique({
      where: { id: request.userId },
      include: { address: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    let stripeCustomer: Stripe.Customer;

    // Create or update Stripe customer
    if (user.stripeCustomerId) {
      stripeCustomer = await this.stripe.customers.retrieve(
        user.stripeCustomerId
      ) as Stripe.Customer;
      
      // Update customer if needed
      await this.stripe.customers.update(user.stripeCustomerId, {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        address: {
          line1: request.billingAddress.addressLine1,
          line2: request.billingAddress.addressLine2 || undefined,
          city: request.billingAddress.city,
          state: request.billingAddress.province,
          postal_code: request.billingAddress.postalCode,
          country: request.billingAddress.country
        },
        phone: user.phone || undefined
      });
    } else {
      // Create new customer
      stripeCustomer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        address: {
          line1: request.billingAddress.addressLine1,
          line2: request.billingAddress.addressLine2 || undefined,
          city: request.billingAddress.city,
          state: request.billingAddress.province,
          postal_code: request.billingAddress.postalCode,
          country: request.billingAddress.country
        },
        phone: user.phone || undefined,
        metadata: {
          userId: user.id,
          source: 'nextjs_template'
        }
      });

      // Update user with Stripe customer ID
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: stripeCustomer.id }
      });
    }

    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(request.paymentMethodId, {
      customer: stripeCustomer.id
    });

    // Set as default payment method
    await this.stripe.customers.update(stripeCustomer.id, {
      invoice_settings: {
        default_payment_method: request.paymentMethodId
      }
    });

    // Calculate taxes for the subscription
    const taxCalculation = calculateCanadianTax(
      plan.price,
      request.billingAddress.province,
      'SUBSCRIPTION'
    );

    // Apply promo code if provided
    let couponId: string | undefined;
    if (request.promoCode) {
      const promoCode = await db.promoCode.findFirst({
        where: {
          code: request.promoCode,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      if (promoCode) {
        // Create Stripe coupon if it doesn't exist
        couponId = await this.getOrCreateStripeCoupon(promoCode);
      }
    }

    // Create subscription in Stripe
    const stripeSubscription = await this.stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{
        price: plan.stripePriceId,
        quantity: 1
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
      trial_period_days: request.trialDays || plan.trialDays || undefined,
      coupon: couponId,
      automatic_tax: {
        enabled: true
      },
      metadata: {
        userId: user.id,
        planId: plan.id,
        taxProvince: request.billingAddress.province,
        ...request.metadata
      }
    });

    // Store subscription in database
    const subscription = await db.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
        status: stripeSubscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        price: plan.price,
        quantity: 1,
        trialStart: stripeSubscription.trial_start 
          ? new Date(stripeSubscription.trial_start * 1000) 
          : null,
        trialEnd: stripeSubscription.trial_end 
          ? new Date(stripeSubscription.trial_end * 1000) 
          : null,
        metadata: request.metadata || {}
      }
    });

    // Update user address if provided
    await db.address.upsert({
      where: { userId: user.id },
      update: {
        firstName: request.billingAddress.firstName,
        lastName: request.billingAddress.lastName,
        addressLine1: request.billingAddress.addressLine1,
        addressLine2: request.billingAddress.addressLine2,
        city: request.billingAddress.city,
        province: request.billingAddress.province,
        postalCode: request.billingAddress.postalCode,
        country: request.billingAddress.country
      },
      create: {
        userId: user.id,
        firstName: request.billingAddress.firstName,
        lastName: request.billingAddress.lastName,
        addressLine1: request.billingAddress.addressLine1,
        addressLine2: request.billingAddress.addressLine2,
        city: request.billingAddress.city,
        province: request.billingAddress.province,
        postalCode: request.billingAddress.postalCode,
        country: request.billingAddress.country
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.SUBSCRIPTION_CHANGE,
        resource: 'subscription',
        resourceId: subscription.id,
        newValues: {
          subscriptionId: stripeSubscription.id,
          planId: plan.id,
          status: stripeSubscription.status
        },
        description: `Subscription created for plan ${plan.name}`
      }
    });

    return {
      subscription: subscription,
      customer: stripeCustomer,
      setupIntent: stripeSubscription.status === 'incomplete' 
        ? (stripeSubscription.latest_invoice as any)?.payment_intent
        : undefined
    };
  }

  /**
   * Update an existing subscription (plan change, quantity change)
   */
  async updateSubscription(request: UpdateSubscriptionRequest): Promise<{
    subscription: any;
    preview: SubscriptionPreview;
  }> {
    // Get existing subscription
    const existingSubscription = await db.subscription.findFirst({
      where: { stripeSubscriptionId: request.subscriptionId },
      include: { user: { include: { address: true } }, plan: true }
    });

    if (!existingSubscription) {
      throw new Error('Subscription not found');
    }

    // Get new plan if changing
    let newPlan = existingSubscription.plan;
    if (request.newPlanId && request.newPlanId !== existingSubscription.planId) {
      const plan = await db.subscriptionPlan.findFirst({
        where: { id: request.newPlanId, isActive: true }
      });
      if (!plan) {
        throw new Error('New subscription plan not found or inactive');
      }
      newPlan = plan;
    }

    // Preview the changes
    const preview = await this.previewSubscriptionChange(request);

    // Update subscription in Stripe
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      request.subscriptionId
    );

    const updateData: Stripe.SubscriptionUpdateParams = {
      proration_behavior: request.prorationBehavior || 'create_prorations',
      items: [{
        id: stripeSubscription.items.data[0].id,
        price: newPlan.stripePriceId,
        quantity: request.quantity || 1
      }]
    };

    if (request.billingCycleAnchor === 'now') {
      updateData.billing_cycle_anchor = 'now';
    }

    const updatedStripeSubscription = await this.stripe.subscriptions.update(
      request.subscriptionId,
      updateData
    );

    // Update subscription in database
    const updatedSubscription = await db.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        planId: newPlan.id,
        price: newPlan.price,
        quantity: request.quantity || existingSubscription.quantity,
        currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000)
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: existingSubscription.userId,
        action: AuditAction.SUBSCRIPTION_CHANGE,
        resource: 'subscription',
        resourceId: existingSubscription.id,
        oldValues: {
          planId: existingSubscription.planId,
          price: existingSubscription.price,
          quantity: existingSubscription.quantity
        },
        newValues: {
          planId: newPlan.id,
          price: newPlan.price,
          quantity: request.quantity || existingSubscription.quantity
        },
        description: `Subscription updated from ${existingSubscription.plan.name} to ${newPlan.name}`
      }
    });

    return {
      subscription: updatedSubscription,
      preview
    };
  }

  /**
   * Cancel a subscription with proper handling of immediate vs end-of-period cancellation
   */
  async cancelSubscription(request: CancelSubscriptionRequest): Promise<{
    subscription: any;
    cancellationDetails: {
      immediate: boolean;
      effectiveDate: Date;
      refundAmount?: number;
    };
  }> {
    // Get existing subscription
    const existingSubscription = await db.subscription.findFirst({
      where: { stripeSubscriptionId: request.subscriptionId },
      include: { user: true, plan: true }
    });

    if (!existingSubscription) {
      throw new Error('Subscription not found');
    }

    let refundAmount: number | undefined;
    let effectiveDate: Date;

    if (request.cancelAtPeriodEnd) {
      // Cancel at period end
      const updatedStripeSubscription = await this.stripe.subscriptions.update(
        request.subscriptionId,
        {
          cancel_at_period_end: true,
          cancellation_details: {
            comment: request.feedback,
            feedback: request.cancellationReason as any
          }
        }
      );

      effectiveDate = new Date(updatedStripeSubscription.current_period_end * 1000);

      // Update database
      await db.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: new Date()
        }
      });
    } else {
      // Cancel immediately
      const canceledStripeSubscription = await this.stripe.subscriptions.cancel(
        request.subscriptionId,
        {
          prorate: request.prorationBehavior === 'create_prorations'
        }
      );

      effectiveDate = new Date();

      // Update database
      await db.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          canceledAt: new Date(),
          endedAt: new Date()
        }
      });

      // Calculate refund if prorating
      if (request.prorationBehavior === 'create_prorations') {
        const remainingDays = Math.ceil(
          (existingSubscription.currentPeriodEnd.getTime() - Date.now()) / 
          (1000 * 60 * 60 * 24)
        );
        const totalDays = Math.ceil(
          (existingSubscription.currentPeriodEnd.getTime() - 
           existingSubscription.currentPeriodStart.getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        refundAmount = Math.round(
          (existingSubscription.price * remainingDays) / totalDays
        );
      }
    }

    // Create notification
    await db.notification.create({
      data: {
        userId: existingSubscription.userId,
        type: NotificationType.SUBSCRIPTION_CANCELLED,
        title: 'Subscription Cancelled',
        message: request.cancelAtPeriodEnd 
          ? `Your ${existingSubscription.plan.name} subscription will end on ${effectiveDate.toLocaleDateString()}.`
          : `Your ${existingSubscription.plan.name} subscription has been cancelled.`,
        email: true,
        emailSubject: 'Subscription Cancellation Confirmation',
        data: {
          subscriptionId: request.subscriptionId,
          planName: existingSubscription.plan.name,
          effectiveDate: effectiveDate.toISOString(),
          immediate: !request.cancelAtPeriodEnd,
          refundAmount: refundAmount || 0
        }
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: existingSubscription.userId,
        action: AuditAction.SUBSCRIPTION_CHANGE,
        resource: 'subscription',
        resourceId: existingSubscription.id,
        oldValues: { status: existingSubscription.status },
        newValues: { 
          status: request.cancelAtPeriodEnd ? 'CANCELLED_AT_PERIOD_END' : 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          reason: request.cancellationReason
        },
        description: `Subscription cancelled - ${request.cancelAtPeriodEnd ? 'at period end' : 'immediately'}`
      }
    });

    return {
      subscription: existingSubscription,
      cancellationDetails: {
        immediate: !request.cancelAtPeriodEnd,
        effectiveDate,
        refundAmount
      }
    };
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<any> {
    const existingSubscription = await db.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      include: { user: true, plan: true }
    });

    if (!existingSubscription) {
      throw new Error('Subscription not found');
    }

    if (existingSubscription.status !== SubscriptionStatus.CANCELLED) {
      throw new Error('Subscription is not cancelled');
    }

    // Reactivate in Stripe
    const reactivatedSubscription = await this.stripe.subscriptions.update(
      subscriptionId,
      { cancel_at_period_end: false }
    );

    // Update database
    const updatedSubscription = await db.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: reactivatedSubscription.status as SubscriptionStatus,
        cancelAtPeriodEnd: false,
        canceledAt: null
      }
    });

    // Create notification
    await db.notification.create({
      data: {
        userId: existingSubscription.userId,
        type: NotificationType.SUBSCRIPTION_RENEWED,
        title: 'Subscription Reactivated',
        message: `Your ${existingSubscription.plan.name} subscription has been reactivated.`,
        email: true,
        emailSubject: 'Subscription Reactivated',
        data: {
          subscriptionId: subscriptionId,
          planName: existingSubscription.plan.name
        }
      }
    });

    return updatedSubscription;
  }

  /**
   * Preview subscription changes before applying them
   */
  async previewSubscriptionChange(request: UpdateSubscriptionRequest): Promise<SubscriptionPreview> {
    const subscription = await db.subscription.findFirst({
      where: { stripeSubscriptionId: request.subscriptionId },
      include: { user: { include: { address: true } }, plan: true }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    let newPlan = subscription.plan;
    if (request.newPlanId) {
      const plan = await db.subscriptionPlan.findFirst({
        where: { id: request.newPlanId }
      });
      if (plan) newPlan = plan;
    }

    // Get upcoming invoice preview from Stripe
    const upcomingInvoice = await this.stripe.invoices.retrieveUpcoming({
      customer: subscription.stripeCustomerId,
      subscription: request.subscriptionId,
      subscription_items: [{
        id: (await this.stripe.subscriptions.retrieve(request.subscriptionId)).items.data[0].id,
        price: newPlan.stripePriceId,
        quantity: request.quantity || 1
      }],
      subscription_proration_behavior: request.prorationBehavior || 'create_prorations'
    });

    // Calculate taxes
    const province = subscription.user.address?.province || 'ON';
    const taxCalculation = calculateCanadianTax(
      upcomingInvoice.amount_due,
      province as CanadianProvince
    );

    return {
      subtotal: upcomingInvoice.subtotal,
      taxAmount: taxCalculation.totalTax,
      total: upcomingInvoice.amount_due,
      prorationAmount: upcomingInvoice.lines.data
        .filter(line => line.proration)
        .reduce((sum, line) => sum + line.amount, 0),
      immediateCharge: upcomingInvoice.amount_due,
      nextInvoiceAmount: newPlan.price + taxCalculation.totalTax,
      nextInvoiceDate: new Date(upcomingInvoice.period_end * 1000),
      taxBreakdown: taxCalculation.breakdown
    };
  }

  /**
   * Get subscription billing portal URL
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const portalSession = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      configuration: await this.getPortalConfiguration()
    });

    return portalSession.url;
  }

  /**
   * Handle subscription dunning (failed payment recovery)
   */
  async handleFailedPayment(
    subscriptionId: string,
    invoiceId: string,
    config: Partial<DunningSettings> = {}
  ): Promise<void> {
    const dunningConfig = { ...DEFAULT_DUNNING_CONFIG, ...config };
    
    const subscription = await db.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      include: { user: true, plan: true }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Update subscription status
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.PAST_DUE }
    });

    // Create dunning process record
    await db.auditLog.create({
      data: {
        userId: subscription.userId,
        action: AuditAction.SUBSCRIPTION_CHANGE,
        resource: 'subscription',
        resourceId: subscription.id,
        newValues: {
          status: 'PAST_DUE',
          dunningStarted: new Date().toISOString(),
          invoiceId: invoiceId
        },
        description: 'Dunning process initiated for failed payment'
      }
    });

    // Send immediate notification
    if (dunningConfig.sendEmailNotifications) {
      await db.notification.create({
        data: {
          userId: subscription.userId,
          type: NotificationType.PAYMENT_FAILED,
          title: 'Payment Failed',
          message: `Your payment for ${subscription.plan.name} failed. Please update your payment method to avoid service interruption.`,
          email: true,
          emailSubject: 'Payment Failed - Action Required',
          data: {
            subscriptionId: subscriptionId,
            planName: subscription.plan.name,
            invoiceId: invoiceId,
            retryAttempts: dunningConfig.maxRetryAttempts,
            gracePeriod: dunningConfig.gracePeriodDays
          }
        }
      });
    }

    // Schedule retry attempts (in production, use a job queue)
    console.log(`Scheduled ${dunningConfig.maxRetryAttempts} retry attempts for subscription ${subscriptionId}`);
  }

  /**
   * Get or create Stripe coupon from promo code
   */
  private async getOrCreateStripeCoupon(promoCode: any): Promise<string> {
    const couponId = `promo_${promoCode.code}`;
    
    try {
      await this.stripe.coupons.retrieve(couponId);
      return couponId;
    } catch (error) {
      // Coupon doesn't exist, create it
      const couponData: Stripe.CouponCreateParams = {
        id: couponId,
        name: promoCode.name,
        duration: 'once' // Modify based on your promo code logic
      };

      if (promoCode.type === 'PERCENTAGE') {
        couponData.percent_off = promoCode.discountPercent;
      } else if (promoCode.type === 'FIXED_AMOUNT') {
        couponData.amount_off = promoCode.discountAmount;
        couponData.currency = 'cad';
      }

      if (promoCode.expiresAt) {
        couponData.redeem_by = Math.floor(promoCode.expiresAt.getTime() / 1000);
      }

      if (promoCode.usageLimit) {
        couponData.max_redemptions = promoCode.usageLimit;
      }

      await this.stripe.coupons.create(couponData);
      return couponId;
    }
  }

  /**
   * Get or create billing portal configuration
   */
  private async getPortalConfiguration(): Promise<string> {
    // In production, you might want to cache this or create it once
    const configuration = await this.stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription',
        privacy_policy_url: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL,
        terms_of_service_url: process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL
      },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'address', 'phone', 'tax_id']
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'customer_service',
              'too_complex',
              'low_quality',
              'other'
            ]
          }
        },
        subscription_pause: { enabled: false },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity'],
          proration_behavior: 'create_prorations'
        }
      }
    });

    return configuration.id;
  }
}

// Export default instance
export const subscriptionManager = new SubscriptionManager(stripe);

export default subscriptionManager;