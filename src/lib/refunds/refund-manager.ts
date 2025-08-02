/**
 * Refund and Cancellation Management System
 * Comprehensive refund processing and order cancellation for NextJS Stripe Payment Template
 * Handles full/partial refunds, subscription cancellations, and digital product access revocation
 */

import {
  OrderStatus,
  RefundStatus,
  PaymentStatus,
  SubscriptionStatus,
  AuditAction,
  NotificationType,
} from '@prisma/client';
import Stripe from 'stripe';

import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';

export interface RefundRequest {
  orderId?: string;
  paymentId?: string;
  subscriptionId?: string;
  amount?: number; // If not provided, full refund
  reason: RefundReason;
  description?: string;
  revokeDigitalAccess?: boolean;
  notifyCustomer?: boolean;
  adminUserId?: string;
  metadata?: Record<string, string>;
}

export interface RefundResult {
  refund: {
    id: string;
    stripeRefundId: string;
    amount: number;
    status: RefundStatus;
    reason: string;
    processedAt: Date | null;
  };
  order?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalRefunded: number;
  };
  subscription?: {
    id: string;
    status: SubscriptionStatus;
    endedAt: Date | null;
  };
  accessRevoked?: boolean;
}

export interface CancellationRequest {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  reason?: CancellationReason;
  feedback?: string;
  prorationRefund?: boolean;
  adminUserId?: string;
  notifyCustomer?: boolean;
}

export interface CancellationResult {
  subscription: {
    id: string;
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    endedAt: Date | null;
    currentPeriodEnd: Date;
  };
  prorationRefund?: {
    amount: number;
    refundId: string;
  };
}

export enum RefundReason {
  REQUESTED_BY_CUSTOMER = 'requested_by_customer',
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  SUBSCRIPTION_CANCELLATION = 'subscription_cancellation',
  PRODUCT_DEFECT = 'product_defect',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  BILLING_ERROR = 'billing_error',
  TECHNICAL_ISSUE = 'technical_issue',
  UNSATISFIED_CUSTOMER = 'unsatisfied_customer',
}

export enum CancellationReason {
  TOO_EXPENSIVE = 'too_expensive',
  MISSING_FEATURES = 'missing_features',
  SWITCHED_SERVICE = 'switched_service',
  UNUSED = 'unused',
  CUSTOMER_SERVICE = 'customer_service',
  TOO_COMPLEX = 'too_complex',
  LOW_QUALITY = 'low_quality',
  OTHER = 'other',
}

export interface RefundPolicy {
  digitalProducts: {
    allowedDays: number;
    conditions: string[];
    requiresApproval: boolean;
  };
  subscriptions: {
    allowedDays: number;
    prorationEnabled: boolean;
    gracePeriodDays: number;
  };
  physicalProducts: {
    allowedDays: number;
    requiresReturn: boolean;
    restockingFee?: number;
  };
}

/**
 * Default refund policy configuration
 */
export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  digitalProducts: {
    allowedDays: 7,
    conditions: ['not_downloaded', 'technical_defect', 'misrepresented'],
    requiresApproval: false,
  },
  subscriptions: {
    allowedDays: 30,
    prorationEnabled: true,
    gracePeriodDays: 7,
  },
  physicalProducts: {
    allowedDays: 30,
    requiresReturn: true,
    restockingFee: 0.15, // 15%
  },
};

/**
 * Refund Manager Class
 * Handles all refund and cancellation operations
 */
export class RefundManager {
  private stripe: Stripe;
  private policy: RefundPolicy;

  constructor(
    stripeClient: Stripe,
    policy: RefundPolicy = DEFAULT_REFUND_POLICY
  ) {
    this.stripe = stripeClient;
    this.policy = policy;
  }

  /**
   * Process a refund for an order or payment
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    // Validate refund request
    await this.validateRefundRequest(request);

    let order: any = null;
    let payment: any = null;
    let subscription: any = null;

    // Get order, payment, or subscription details
    if (request.orderId) {
      order = await db.order.findUnique({
        where: { id: request.orderId },
        include: {
          payments: true,
          items: { include: { product: true } },
          user: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      payment = order.payments.find(
        (p: any) => p.status === PaymentStatus.SUCCEEDED
      );
      if (!payment) {
        throw new Error('No successful payment found for this order');
      }
    } else if (request.paymentId) {
      payment = await db.payment.findUnique({
        where: { id: request.paymentId },
        include: {
          order: {
            include: {
              items: { include: { product: true } },
              user: true,
            },
          },
        },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      order = payment.order;
    } else if (request.subscriptionId) {
      subscription = await db.subscription.findUnique({
        where: { id: request.subscriptionId },
        include: { user: true, plan: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }
    }

    // Calculate refund amount
    const refundAmount = this.calculateRefundAmount(
      request,
      order,
      payment,
      subscription
    );

    // Process refund in Stripe
    let stripeRefund: Stripe.Refund;

    if (payment) {
      stripeRefund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundAmount,
        reason: this.mapRefundReasonToStripe(request.reason),
        metadata: {
          orderId: order?.id || '',
          adminUserId: request.adminUserId || '',
          refundReason: request.reason,
          ...request.metadata,
        },
      });
    } else if (subscription) {
      // For subscription refunds, we need to handle this differently
      // Usually done through invoice credit or direct refund
      throw new Error('Subscription refunds not implemented in this example');
    } else {
      throw new Error('No payment or subscription to refund');
    }

    // Create refund record in database
    const refund = await db.refund.create({
      data: {
        orderId: order?.id,
        paymentId: payment?.id,
        stripeRefundId: stripeRefund.id,
        status: stripeRefund.status as RefundStatus,
        amount: stripeRefund.amount,
        reason: request.reason,
        description: request.description,
        processedBy: request.adminUserId,
        processedAt: stripeRefund.status === 'succeeded' ? new Date() : null,
      },
    });

    // Update order status
    let updatedOrder: any = null;
    if (order) {
      const totalRefunded = await this.calculateTotalRefunded(order.id);
      const newStatus =
        totalRefunded >= order.totalAmount
          ? OrderStatus.REFUNDED
          : OrderStatus.PARTIALLY_REFUNDED;

      updatedOrder = await db.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          adminNotes: `${request.description || 'Refund processed'} - Amount: $${refundAmount / 100}`,
        },
      });
    }

    // Revoke digital access if requested
    let accessRevoked = false;
    if (request.revokeDigitalAccess && order) {
      accessRevoked = await this.revokeDigitalAccess(order.id);
    }

    // Send notification to customer
    if (
      request.notifyCustomer !== false &&
      (order?.user || subscription?.user)
    ) {
      await this.sendRefundNotification(
        order?.user || subscription?.user,
        refund,
        order,
        subscription
      );
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: order?.userId || subscription?.userId,
        action: AuditAction.REFUND,
        resource: order ? 'order' : 'subscription',
        resourceId: order?.id || subscription?.id || '',
        newValues: {
          refundId: refund.id,
          amount: refundAmount,
          reason: request.reason,
          processedBy: request.adminUserId,
        },
        description: `Refund processed: $${refundAmount / 100} for ${request.reason}`,
        ipAddress: request.metadata?.ipAddress,
        userAgent: request.metadata?.userAgent,
      },
    });

    return {
      refund: {
        id: refund.id,
        stripeRefundId: stripeRefund.id,
        amount: stripeRefund.amount,
        status: stripeRefund.status as RefundStatus,
        reason: request.reason,
        processedAt: refund.processedAt,
      },
      order: updatedOrder
        ? {
            id: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            status: updatedOrder.status,
            totalRefunded: await this.calculateTotalRefunded(updatedOrder.id),
          }
        : undefined,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            endedAt: subscription.endedAt,
          }
        : undefined,
      accessRevoked,
    };
  }

  /**
   * Cancel a subscription with optional prorated refund
   */
  async cancelSubscription(
    request: CancellationRequest
  ): Promise<CancellationResult> {
    const subscription = await db.subscription.findUnique({
      where: { id: request.subscriptionId },
      include: { user: true, plan: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new Error('Subscription is already cancelled');
    }

    let prorationRefund: { amount: number; refundId: string } | undefined;

    if (request.cancelAtPeriodEnd) {
      // Cancel at period end - no immediate refund
      const updatedStripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
          cancellation_details: {
            comment: request.feedback,
            feedback: request.reason as any,
          },
        }
      );

      // Update database
      const updatedSubscription = await db.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
        },
      });

      return {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: true,
          canceledAt: updatedSubscription.canceledAt,
          endedAt: updatedSubscription.endedAt,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        },
      };
    } else {
      // Cancel immediately with optional proration refund
      const canceledStripeSubscription = await this.stripe.subscriptions.cancel(
        subscription.stripeSubscriptionId,
        {
          prorate: request.prorationRefund,
        }
      );

      // Calculate prorated refund if enabled
      if (request.prorationRefund) {
        const remainingDays = Math.ceil(
          (subscription.currentPeriodEnd.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        );
        const billingCycleDays = Math.ceil(
          (subscription.currentPeriodEnd.getTime() -
            subscription.currentPeriodStart.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (remainingDays > 0 && billingCycleDays > 0) {
          const refundAmount = Math.round(
            (subscription.price * remainingDays) / billingCycleDays
          );

          if (refundAmount > 0) {
            // Process refund
            const refundResult = await this.processRefund({
              subscriptionId: subscription.id,
              amount: refundAmount,
              reason: RefundReason.SUBSCRIPTION_CANCELLATION,
              description: 'Prorated refund for subscription cancellation',
              adminUserId: request.adminUserId,
              notifyCustomer: request.notifyCustomer,
            });

            prorationRefund = {
              amount: refundAmount,
              refundId: refundResult.refund.id,
            };
          }
        }
      }

      // Update database
      const updatedSubscription = await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          canceledAt: new Date(),
          endedAt: new Date(),
        },
      });

      // Send cancellation notification
      if (request.notifyCustomer !== false) {
        await db.notification.create({
          data: {
            userId: subscription.userId,
            type: NotificationType.SUBSCRIPTION_CANCELLED,
            title: 'Subscription Cancelled',
            message: `Your ${subscription.plan.name} subscription has been cancelled${prorationRefund ? ` and a refund of $${prorationRefund.amount / 100} has been processed` : ''}.`,
            email: true,
            emailSubject: 'Subscription Cancelled',
            data: {
              subscriptionId: subscription.id,
              planName: subscription.plan.name,
              cancelledAt: new Date().toISOString(),
              prorationRefund: prorationRefund?.amount || 0,
              reason: request.reason,
            },
          },
        });
      }

      return {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: false,
          canceledAt: updatedSubscription.canceledAt,
          endedAt: updatedSubscription.endedAt,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        },
        prorationRefund,
      };
    }
  }

  /**
   * Check if refund is eligible based on policy
   */
  async checkRefundEligibility(orderId: string): Promise<{
    eligible: boolean;
    reasons: string[];
    policy: any;
  }> {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    });

    if (!order) {
      return {
        eligible: false,
        reasons: ['Order not found'],
        policy: null,
      };
    }

    const reasons: string[] = [];
    let eligible = true;

    // Check order age
    const orderAge = Date.now() - order.createdAt.getTime();
    const maxAgeMs =
      this.policy.digitalProducts.allowedDays * 24 * 60 * 60 * 1000;

    if (orderAge > maxAgeMs) {
      eligible = false;
      reasons.push(
        `Refund window expired (${this.policy.digitalProducts.allowedDays} days)`
      );
    }

    // Check if order is already refunded
    if (order.status === OrderStatus.REFUNDED) {
      eligible = false;
      reasons.push('Order is already fully refunded');
    }

    // Check payment status
    const successfulPayment = order.payments.find(
      p => p.status === PaymentStatus.SUCCEEDED
    );
    if (!successfulPayment) {
      eligible = false;
      reasons.push('No successful payment found');
    }

    // Check digital product downloads (if policy requires)
    if (this.policy.digitalProducts.conditions.includes('not_downloaded')) {
      const hasDownloads = await db.download.count({
        where: {
          orderItem: {
            orderId: order.id,
          },
          downloadCount: { gt: 0 },
        },
      });

      if (hasDownloads > 0) {
        // Allow refund but note the download activity
        reasons.push(
          'Product has been downloaded but refund may still be eligible'
        );
      }
    }

    return {
      eligible,
      reasons,
      policy: this.policy.digitalProducts,
    };
  }

  /**
   * Get refund history for an order
   */
  async getRefundHistory(orderId: string): Promise<
    Array<{
      id: string;
      amount: number;
      status: RefundStatus;
      reason: string;
      processedAt: Date | null;
      processedBy: string | null;
    }>
  > {
    const refunds = await db.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    return refunds.map(refund => ({
      id: refund.id,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason || '',
      processedAt: refund.processedAt,
      processedBy: refund.processedBy,
    }));
  }

  /**
   * Validate refund request
   */
  private async validateRefundRequest(request: RefundRequest): Promise<void> {
    if (!request.orderId && !request.paymentId && !request.subscriptionId) {
      throw new Error(
        'Either orderId, paymentId, or subscriptionId is required'
      );
    }

    if (!Object.values(RefundReason).includes(request.reason)) {
      throw new Error('Invalid refund reason');
    }

    if (request.amount && request.amount <= 0) {
      throw new Error('Refund amount must be positive');
    }
  }

  /**
   * Calculate refund amount
   */
  private calculateRefundAmount(
    request: RefundRequest,
    order: any,
    payment: any,
    subscription: any
  ): number {
    if (request.amount) {
      return request.amount;
    }

    if (payment) {
      return payment.amount;
    }

    if (order) {
      return order.totalAmount;
    }

    if (subscription) {
      // Calculate prorated amount for subscription
      const remainingDays = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );
      const billingCycleDays = Math.ceil(
        (subscription.currentPeriodEnd.getTime() -
          subscription.currentPeriodStart.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return Math.round(
        (subscription.price * remainingDays) / billingCycleDays
      );
    }

    throw new Error('Unable to calculate refund amount');
  }

  /**
   * Calculate total refunded amount for an order
   */
  private async calculateTotalRefunded(orderId: string): Promise<number> {
    const refunds = await db.refund.findMany({
      where: {
        orderId,
        status: RefundStatus.SUCCEEDED,
      },
    });

    return refunds.reduce((total, refund) => total + refund.amount, 0);
  }

  /**
   * Revoke digital access for refunded order
   */
  private async revokeDigitalAccess(orderId: string): Promise<boolean> {
    const result = await db.download.updateMany({
      where: {
        orderItem: {
          orderId,
        },
      },
      data: {
        isActive: false,
      },
    });

    return result.count > 0;
  }

  /**
   * Send refund notification to customer
   */
  private async sendRefundNotification(
    user: any,
    refund: any,
    order?: any,
    subscription?: any
  ): Promise<void> {
    await db.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.REFUND_PROCESSED,
        title: 'Refund Processed',
        message: `Your refund of $${refund.amount / 100} has been processed and will appear in your account within 5-10 business days.`,
        email: true,
        emailSubject: 'Refund Processed - Confirmation',
        data: {
          refundAmount: refund.amount,
          refundId: refund.stripeRefundId,
          orderId: order?.id,
          orderNumber: order?.orderNumber,
          subscriptionId: subscription?.id,
          reason: refund.reason,
        },
      },
    });
  }

  /**
   * Map internal refund reason to Stripe refund reason
   */
  private mapRefundReasonToStripe(
    reason: RefundReason
  ): Stripe.RefundCreateParams.Reason {
    const mapping: Record<RefundReason, Stripe.RefundCreateParams.Reason> = {
      [RefundReason.REQUESTED_BY_CUSTOMER]: 'requested_by_customer',
      [RefundReason.DUPLICATE]: 'duplicate',
      [RefundReason.FRAUDULENT]: 'fraudulent',
      [RefundReason.SUBSCRIPTION_CANCELLATION]: 'requested_by_customer',
      [RefundReason.PRODUCT_DEFECT]: 'requested_by_customer',
      [RefundReason.SERVICE_UNAVAILABLE]: 'requested_by_customer',
      [RefundReason.BILLING_ERROR]: 'requested_by_customer',
      [RefundReason.TECHNICAL_ISSUE]: 'requested_by_customer',
      [RefundReason.UNSATISFIED_CUSTOMER]: 'requested_by_customer',
    };

    return mapping[reason] || 'requested_by_customer';
  }
}

// Export default instance
export const refundManager = new RefundManager(stripe);

export default refundManager;
