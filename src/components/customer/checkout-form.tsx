"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCAD } from "@/lib/utils";
import { CreditCard, Shield, Lock, MapPin, User, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutFormProps {
  subtotal: number;
  tax: number;
  total: number;
  isLoading?: boolean;
  onSubmit?: (formData: CheckoutFormData) => void;
  className?: string;
}

interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  billingDifferent: boolean;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
}

const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'YT', name: 'Yukon' },
];

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  subtotal,
  tax,
  total,
  isLoading = false,
  onSubmit,
  className,
}) => {
  const [formData, setFormData] = React.useState<CheckoutFormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      province: 'ON',
      postalCode: '',
      country: 'CA',
    },
    billingDifferent: false,
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Address validation
    if (!formData.address.line1.trim()) {
      newErrors['address.line1'] = 'Address is required';
    }
    if (!formData.address.city.trim()) {
      newErrors['address.city'] = 'City is required';
    }
    if (!formData.address.postalCode.trim()) {
      newErrors['address.postalCode'] = 'Postal code is required';
    } else if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(formData.address.postalCode)) {
      newErrors['address.postalCode'] = 'Please enter a valid Canadian postal code (e.g., K1A 0A9)';
    }

    // Phone validation (optional but if provided, should be valid)
    if (formData.phone && !/^(\+1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid Canadian phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !onSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (path: string, value: string) => {
    setFormData(prev => {
      const keys = path.split('.');
      const newData = { ...prev };
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return newData;
    });

    // Clear error when user starts typing
    if (errors[path]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[path];
        return newErrors;
      });
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData('email', e.target.value)}
              error={errors.email}
              required
              placeholder="john@example.com"
            />
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                value={formData.firstName}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                error={errors.firstName}
                required
                placeholder="John"
              />
              
              <Input
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => updateFormData('lastName', e.target.value)}
                error={errors.lastName}
                required
                placeholder="Doe"
              />
            </div>
            
            <Input
              label="Phone Number (Optional)"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateFormData('phone', e.target.value)}
              error={errors.phone}
              placeholder="(555) 123-4567"
              helperText="We'll only use this for order updates"
            />
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Shipping Address
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Input
              label="Address Line 1"
              value={formData.address.line1}
              onChange={(e) => updateFormData('address.line1', e.target.value)}
              error={errors['address.line1']}
              required
              placeholder="123 Main Street"
            />
            
            <Input
              label="Address Line 2 (Optional)"
              value={formData.address.line2}
              onChange={(e) => updateFormData('address.line2', e.target.value)}
              placeholder="Apartment, suite, etc."
            />
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="City"
                value={formData.address.city}
                onChange={(e) => updateFormData('address.city', e.target.value)}
                error={errors['address.city']}
                required
                placeholder="Toronto"
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Province <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.address.province}
                  onChange={(e) => updateFormData('address.province', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  {CANADIAN_PROVINCES.map(province => (
                    <option key={province.code} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <Input
                label="Postal Code"
                value={formData.address.postalCode}
                onChange={(e) => updateFormData('address.postalCode', e.target.value.toUpperCase())}
                error={errors['address.postalCode']}
                required
                placeholder="K1A 0A9"
                maxLength={7}
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="currency-cad">{formatCAD(subtotal)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({formData.address.province})
              </span>
              <span className="currency-cad">{formatCAD(tax)}</span>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="currency-cad">{formatCAD(total)}</span>
              </div>
            </div>
            
            {/* Security Notice */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Shield className="h-4 w-4" />
              <span>
                Your payment information is encrypted and secure. We use Stripe for payment processing.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isLoading || isSubmitting}
          loading={isSubmitting}
        >
          <Lock className="mr-2 h-4 w-4" />
          Continue to Payment
        </Button>
      </form>

      {/* Trust Indicators */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          <span>SSL Encrypted</span>
        </div>
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          <span>Secure Checkout</span>
        </div>
        <div className="flex items-center gap-1">
          <CreditCard className="h-3 w-3" />
          <span>Powered by Stripe</span>
        </div>
      </div>
    </div>
  );
};

export { CheckoutForm, type CheckoutFormData, CANADIAN_PROVINCES };