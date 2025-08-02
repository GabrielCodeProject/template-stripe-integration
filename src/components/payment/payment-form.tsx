'use client';

import {
  CreditCard,
  Shield,
  Lock,
  CheckCircle,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCAD, cn } from '@/lib/utils';

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

interface PaymentFormProps {
  amount: number;
  currency?: string;
  description?: string;
  paymentMethods?: PaymentMethod[];
  selectedPaymentMethod?: string;
  isLoading?: boolean;
  error?: string;
  success?: boolean;
  onSubmit?: (paymentData: PaymentData) => Promise<void>;
  onPaymentMethodChange?: (methodId: string) => void;
  onAddPaymentMethod?: () => void;
  className?: string;
}

interface PaymentData {
  paymentMethodId: string;
  amount: number;
  currency: string;
  savePaymentMethod?: boolean;
}

interface CreditCardFormProps {
  onSubmit?: (cardData: CreditCardData) => void;
  isLoading?: boolean;
  error?: string;
}

interface CreditCardData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
  cardholderName: string;
  saveCard: boolean;
}

const CreditCardForm: React.FC<CreditCardFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
}) => {
  const [cardData, setCardData] = React.useState<CreditCardData>({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    cardholderName: '',
    saveCard: false,
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const validateCard = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Card number validation
    const cardNumber = cardData.cardNumber.replace(/\s/g, '');
    if (!cardNumber) {
      newErrors.cardNumber = 'Card number is required';
    } else if (cardNumber.length < 13 || cardNumber.length > 19) {
      newErrors.cardNumber = 'Please enter a valid card number';
    }

    // Expiry validation
    if (!cardData.expiryMonth) {
      newErrors.expiryMonth = 'Month is required';
    } else if (
      parseInt(cardData.expiryMonth) < 1 ||
      parseInt(cardData.expiryMonth) > 12
    ) {
      newErrors.expiryMonth = 'Invalid month';
    }

    if (!cardData.expiryYear) {
      newErrors.expiryYear = 'Year is required';
    } else {
      const currentYear = new Date().getFullYear();
      const year = parseInt(cardData.expiryYear);
      if (year < currentYear || year > currentYear + 10) {
        newErrors.expiryYear = 'Invalid year';
      }
    }

    // CVC validation
    if (!cardData.cvc) {
      newErrors.cvc = 'CVC is required';
    } else if (cardData.cvc.length < 3 || cardData.cvc.length > 4) {
      newErrors.cvc = 'Invalid CVC';
    }

    // Name validation
    if (!cardData.cardholderName.trim()) {
      newErrors.cardholderName = 'Cardholder name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateCard() && onSubmit) {
      onSubmit(cardData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Input
        label="Cardholder Name"
        value={cardData.cardholderName}
        onChange={e =>
          setCardData(prev => ({ ...prev, cardholderName: e.target.value }))
        }
        error={errors.cardholderName}
        placeholder="John Doe"
        disabled={isLoading}
        required
      />

      <Input
        label="Card Number"
        value={cardData.cardNumber}
        onChange={e =>
          setCardData(prev => ({
            ...prev,
            cardNumber: formatCardNumber(e.target.value),
          }))
        }
        error={errors.cardNumber}
        placeholder="1234 5678 9012 3456"
        maxLength={19}
        disabled={isLoading}
        required
      />

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="MM"
          value={cardData.expiryMonth}
          onChange={e =>
            setCardData(prev => ({ ...prev, expiryMonth: e.target.value }))
          }
          error={errors.expiryMonth}
          placeholder="12"
          maxLength={2}
          disabled={isLoading}
          required
        />

        <Input
          label="YYYY"
          value={cardData.expiryYear}
          onChange={e =>
            setCardData(prev => ({ ...prev, expiryYear: e.target.value }))
          }
          error={errors.expiryYear}
          placeholder="2024"
          maxLength={4}
          disabled={isLoading}
          required
        />

        <Input
          label="CVC"
          value={cardData.cvc}
          onChange={e =>
            setCardData(prev => ({ ...prev, cvc: e.target.value }))
          }
          error={errors.cvc}
          placeholder="123"
          maxLength={4}
          disabled={isLoading}
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="save-card"
          checked={cardData.saveCard}
          onChange={e =>
            setCardData(prev => ({ ...prev, saveCard: e.target.checked }))
          }
          className="border-input rounded"
          disabled={isLoading}
        />
        <label htmlFor="save-card" className="text-muted-foreground text-sm">
          Save this card for future purchases
        </label>
      </div>
    </form>
  );
};

const PaymentMethodCard: React.FC<{
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ method, isSelected, onSelect }) => {
  const getCardIcon = () => {
    switch (method.brand?.toLowerCase()) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border-2 p-4 transition-colors',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getCardIcon()}</div>
          <div>
            <p className="font-medium">
              {method.brand} •••• {method.last4}
            </p>
            <p className="text-muted-foreground text-sm">
              Expires {method.expiryMonth?.toString().padStart(2, '0')}/
              {method.expiryYear}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {method.isDefault && (
            <Badge variant="secondary" className="text-xs">
              Default
            </Badge>
          )}
          <div
            className={cn(
              'h-4 w-4 rounded-full border-2',
              isSelected
                ? 'border-primary bg-primary'
                : 'border-muted-foreground'
            )}
          >
            {isSelected && (
              <CheckCircle className="text-primary-foreground h-full w-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  currency = 'CAD',
  description,
  paymentMethods = [],
  selectedPaymentMethod,
  isLoading = false,
  error,
  success = false,
  onSubmit,
  onPaymentMethodChange,
  onAddPaymentMethod: _onAddPaymentMethod,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showNewCardForm, setShowNewCardForm] = React.useState(
    paymentMethods.length === 0
  );
  const [newCardData, setNewCardData] = React.useState<CreditCardData | null>(
    null
  );

  const handleSubmit = async () => {
    if (!onSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentData: PaymentData = {
        paymentMethodId: selectedPaymentMethod || 'new_card',
        amount,
        currency,
        savePaymentMethod: newCardData?.saveCard || false,
      };

      await onSubmit(paymentData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewCardSubmit = (cardData: CreditCardData) => {
    setNewCardData(cardData);
    handleSubmit();
  };

  if (success) {
    return (
      <Card className={cn('mx-auto w-full max-w-md', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-success mx-auto mb-4 h-12 w-12">
            <CheckCircle className="h-full w-full" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Payment Successful!</h3>
          <p className="text-muted-foreground mb-4">
            Your payment of {formatCAD(amount)} has been processed successfully.
          </p>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('mx-auto w-full max-w-md', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Amount Display */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Total Amount</span>
            <span className="currency-cad text-xl font-bold">
              {formatCAD(amount)}
            </span>
          </div>
        </div>

        {/* Existing Payment Methods */}
        {paymentMethods.length > 0 && !showNewCardForm && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Select Payment Method</h4>
            {paymentMethods.map(method => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                isSelected={selectedPaymentMethod === method.id}
                onSelect={() => onPaymentMethodChange?.(method.id)}
              />
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowNewCardForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New Card
            </Button>
          </div>
        )}

        {/* New Card Form */}
        {showNewCardForm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Add New Card</h4>
              {paymentMethods.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewCardForm(false)}
                >
                  Cancel
                </Button>
              )}
            </div>

            <CreditCardForm
              onSubmit={handleNewCardSubmit}
              isLoading={isLoading || isSubmitting}
              error={error}
            />
          </div>
        )}

        {/* Submit Button */}
        {!showNewCardForm && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting || !selectedPaymentMethod}
            loading={isSubmitting}
          >
            <Lock className="mr-2 h-4 w-4" />
            Pay {formatCAD(amount)}
          </Button>
        )}

        {/* Security Notice */}
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
          <Shield className="h-3 w-3" />
          <span>Secured by Stripe • Your payment information is encrypted</span>
        </div>
      </CardContent>
    </Card>
  );
};

export { PaymentForm, CreditCardForm, type PaymentData, type PaymentMethod };
