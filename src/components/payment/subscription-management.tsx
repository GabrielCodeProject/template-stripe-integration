'use client';

import {
  CreditCard,
  Pause,
  Play,
  X,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCAD, formatInterval } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Subscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
    intervalCount: number;
  };
  paymentMethod?: {
    type: string;
    last4: string;
    brand: string;
  };
  nextInvoice?: {
    date: string;
    amount: number;
  };
  discount?: {
    coupon: {
      name: string;
      percentOff?: number;
      amountOff?: number;
    };
  };
}

interface SubscriptionManagementProps {
  subscription: Subscription;
  isLoading?: boolean;
  onUpgrade?: () => void;
  onDowngrade?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onUpdatePaymentMethod?: () => void;
  onViewInvoices?: () => void;
  className?: string;
}

const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
  if (cancelAtPeriodEnd && status === 'active') {
    return <Badge variant="warning">Canceling</Badge>;
  }

  switch (status) {
    case 'active':
      return <Badge variant="active">Active</Badge>;
    case 'past_due':
      return <Badge variant="past_due">Past Due</Badge>;
    case 'canceled':
      return <Badge variant="cancelled">Canceled</Badge>;
    case 'unpaid':
      return <Badge variant="unpaid">Unpaid</Badge>;
    case 'paused':
      return <Badge variant="inactive">Paused</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getStatusIcon = (status: string, cancelAtPeriodEnd: boolean) => {
  if (cancelAtPeriodEnd && status === 'active') {
    return <AlertTriangle className="text-warning h-4 w-4" />;
  }

  switch (status) {
    case 'active':
      return <CheckCircle className="text-success h-4 w-4" />;
    case 'past_due':
      return <Clock className="text-warning h-4 w-4" />;
    case 'canceled':
      return <X className="text-muted-foreground h-4 w-4" />;
    case 'unpaid':
      return <AlertTriangle className="text-destructive h-4 w-4" />;
    case 'paused':
      return <Pause className="text-muted-foreground h-4 w-4" />;
    default:
      return <Clock className="text-muted-foreground h-4 w-4" />;
  }
};

const SubscriptionCard: React.FC<{ subscription: Subscription }> = ({
  subscription,
}) => {
  const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
  const nextInvoiceDate = subscription.nextInvoice
    ? new Date(subscription.nextInvoice.date)
    : currentPeriodEnd;

  return (
    <Card className="card-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{subscription.plan.name}</CardTitle>
          {getStatusBadge(subscription.status, subscription.cancelAtPeriodEnd)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Plan Details */}
        <div className="flex items-center justify-between">
          <div>
            <p className="currency-cad text-2xl font-bold">
              {formatCAD(subscription.plan.amount)}
            </p>
            <p className="text-muted-foreground text-sm">
              per{' '}
              {formatInterval(
                subscription.plan.interval,
                subscription.plan.intervalCount
              )}
            </p>
          </div>

          {subscription.discount && (
            <div className="text-right">
              <Badge variant="success" className="text-xs">
                {subscription.discount.coupon.percentOff
                  ? `${subscription.discount.coupon.percentOff}% OFF`
                  : `${formatCAD(subscription.discount.coupon.amountOff || 0)} OFF`}
              </Badge>
              <p className="text-muted-foreground mt-1 text-xs">
                {subscription.discount.coupon.name}
              </p>
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
          {getStatusIcon(subscription.status, subscription.cancelAtPeriodEnd)}
          <div className="flex-1">
            {subscription.cancelAtPeriodEnd ? (
              <p className="text-sm">
                Your subscription will cancel on{' '}
                <span className="font-medium">
                  {currentPeriodEnd.toLocaleDateString()}
                </span>
              </p>
            ) : subscription.status === 'active' ? (
              <p className="text-sm">
                Your subscription renews on{' '}
                <span className="font-medium">
                  {currentPeriodEnd.toLocaleDateString()}
                </span>
              </p>
            ) : subscription.status === 'past_due' ? (
              <p className="text-warning text-sm">
                Payment failed. Please update your payment method.
              </p>
            ) : subscription.status === 'unpaid' ? (
              <p className="text-destructive text-sm">
                Your subscription is unpaid. Update payment method to continue.
              </p>
            ) : (
              <p className="text-sm capitalize">{subscription.status}</p>
            )}
          </div>
        </div>

        {/* Next Invoice */}
        {subscription.nextInvoice &&
          subscription.status === 'active' &&
          !subscription.cancelAtPeriodEnd && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Next invoice:</span>
              <div className="text-right">
                <p className="currency-cad font-medium">
                  {formatCAD(subscription.nextInvoice.amount)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {nextInvoiceDate.toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

        {/* Payment Method */}
        {subscription.paymentMethod && (
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground">
              {subscription.paymentMethod.brand} ••••{' '}
              {subscription.paymentMethod.last4}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({
  subscription,
  isLoading = false,
  onUpgrade,
  onDowngrade,
  onPause,
  onResume,
  onCancel,
  onUpdatePaymentMethod,
  onViewInvoices,
  className,
}) => {
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const handleAction = async (action: () => void, actionName: string) => {
    setActionLoading(actionName);
    try {
      await action();
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="bg-muted h-6 w-1/3 rounded" />
              <div className="bg-muted h-6 w-16 rounded" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted h-12 rounded" />
            <div className="bg-muted h-8 rounded" />
            <div className="bg-muted h-4 w-2/3 rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const canUpgrade =
    subscription.status === 'active' && !subscription.cancelAtPeriodEnd;
  const canPause =
    subscription.status === 'active' && !subscription.cancelAtPeriodEnd;
  const canResume = subscription.status === 'paused';
  const canCancel =
    ['active', 'past_due'].includes(subscription.status) &&
    !subscription.cancelAtPeriodEnd;
  const needsPaymentUpdate = ['past_due', 'unpaid'].includes(
    subscription.status
  );

  return (
    <div className={cn('space-y-6', className)}>
      <SubscriptionCard subscription={subscription} />

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manage Subscription</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Urgent Actions */}
          {needsPaymentUpdate && onUpdatePaymentMethod && (
            <Button
              className="w-full"
              variant="destructive"
              onClick={() =>
                handleAction(onUpdatePaymentMethod, 'updatePayment')
              }
              loading={actionLoading === 'updatePayment'}
              disabled={!!actionLoading}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Update Payment Method
            </Button>
          )}

          {/* Plan Changes */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {onUpgrade && canUpgrade && (
              <Button
                variant="outline"
                onClick={() => handleAction(onUpgrade, 'upgrade')}
                loading={actionLoading === 'upgrade'}
                disabled={!!actionLoading}
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            )}

            {onDowngrade && canUpgrade && (
              <Button
                variant="outline"
                onClick={() => handleAction(onDowngrade, 'downgrade')}
                loading={actionLoading === 'downgrade'}
                disabled={!!actionLoading}
              >
                <ArrowUpRight className="mr-2 h-4 w-4 rotate-180" />
                Downgrade Plan
              </Button>
            )}
          </div>

          {/* Subscription Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {onPause && canPause && (
              <Button
                variant="outline"
                onClick={() => handleAction(onPause, 'pause')}
                loading={actionLoading === 'pause'}
                disabled={!!actionLoading}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pause Subscription
              </Button>
            )}

            {onResume && canResume && (
              <Button
                variant="outline"
                onClick={() => handleAction(onResume, 'resume')}
                loading={actionLoading === 'resume'}
                disabled={!!actionLoading}
              >
                <Play className="mr-2 h-4 w-4" />
                Resume Subscription
              </Button>
            )}
          </div>

          {/* Other Actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {onUpdatePaymentMethod && !needsPaymentUpdate && (
              <Button
                variant="outline"
                onClick={() =>
                  handleAction(onUpdatePaymentMethod, 'updatePayment')
                }
                loading={actionLoading === 'updatePayment'}
                disabled={!!actionLoading}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment
              </Button>
            )}

            {onViewInvoices && (
              <Button
                variant="outline"
                onClick={() => handleAction(onViewInvoices, 'viewInvoices')}
                loading={actionLoading === 'viewInvoices'}
                disabled={!!actionLoading}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                View Invoices
              </Button>
            )}
          </div>

          {/* Cancel Subscription */}
          {onCancel && canCancel && (
            <div className="border-t pt-4">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => handleAction(onCancel, 'cancel')}
                loading={actionLoading === 'cancel'}
                disabled={!!actionLoading}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel Subscription
              </Button>
              <p className="text-muted-foreground mt-2 text-center text-xs">
                You'll continue to have access until your current billing period
                ends
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History Link */}
      {subscription.status !== 'canceled' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-3 text-sm">
                Need to download receipts or view your billing history?
              </p>
              <Button variant="outline" size="sm">
                Access Stripe Customer Portal
                <ArrowUpRight className="ml-2 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { SubscriptionManagement, type Subscription };
