'use client';

import { Info, Calculator, MapPin } from 'lucide-react';
import * as React from 'react';

import { CANADIAN_PROVINCES } from '@/components/customer/checkout-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCAD } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TaxBreakdown {
  subtotal: number;
  gst?: number;
  pst?: number;
  hst?: number;
  qst?: number;
  total: number;
  province: string;
}

interface CanadianTaxDisplayProps {
  subtotal: number;
  province: string;
  showBreakdown?: boolean;
  showInfo?: boolean;
  className?: string;
}

const getTaxInfo = (province: string) => {
  const taxInfo: Record<
    string,
    {
      rate: number;
      taxes: Array<{ name: string; rate: number; description: string }>;
      description: string;
    }
  > = {
    AB: {
      rate: 0.05,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
      ],
      description: 'Alberta only charges GST',
    },
    BC: {
      rate: 0.12,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
        { name: 'PST', rate: 0.07, description: 'Provincial Sales Tax' },
      ],
      description: 'British Columbia charges GST + PST',
    },
    MB: {
      rate: 0.12,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
        { name: 'PST', rate: 0.07, description: 'Provincial Sales Tax' },
      ],
      description: 'Manitoba charges GST + PST',
    },
    NB: {
      rate: 0.15,
      taxes: [{ name: 'HST', rate: 0.15, description: 'Harmonized Sales Tax' }],
      description: 'New Brunswick uses HST',
    },
    NL: {
      rate: 0.15,
      taxes: [{ name: 'HST', rate: 0.15, description: 'Harmonized Sales Tax' }],
      description: 'Newfoundland and Labrador uses HST',
    },
    NS: {
      rate: 0.15,
      taxes: [{ name: 'HST', rate: 0.15, description: 'Harmonized Sales Tax' }],
      description: 'Nova Scotia uses HST',
    },
    ON: {
      rate: 0.13,
      taxes: [{ name: 'HST', rate: 0.13, description: 'Harmonized Sales Tax' }],
      description: 'Ontario uses HST',
    },
    PE: {
      rate: 0.15,
      taxes: [{ name: 'HST', rate: 0.15, description: 'Harmonized Sales Tax' }],
      description: 'Prince Edward Island uses HST',
    },
    QC: {
      rate: 0.14975,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
        { name: 'QST', rate: 0.09975, description: 'Quebec Sales Tax' },
      ],
      description: 'Quebec charges GST + QST',
    },
    SK: {
      rate: 0.11,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
        { name: 'PST', rate: 0.06, description: 'Provincial Sales Tax' },
      ],
      description: 'Saskatchewan charges GST + PST',
    },
    NT: {
      rate: 0.05,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
      ],
      description: 'Northwest Territories only charges GST',
    },
    NU: {
      rate: 0.05,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
      ],
      description: 'Nunavut only charges GST',
    },
    YT: {
      rate: 0.05,
      taxes: [
        { name: 'GST', rate: 0.05, description: 'Goods and Services Tax' },
      ],
      description: 'Yukon only charges GST',
    },
  };

  return taxInfo[province] || taxInfo['ON']; // Default to Ontario
};

const calculateDetailedTax = (
  subtotal: number,
  province: string
): TaxBreakdown => {
  const taxInfo = getTaxInfo(province);
  const breakdown: TaxBreakdown = {
    subtotal,
    total: subtotal,
    province,
  };

  taxInfo.taxes.forEach(tax => {
    const amount = subtotal * tax.rate;
    breakdown.total += amount;

    switch (tax.name) {
      case 'GST':
        breakdown.gst = amount;
        break;
      case 'PST':
        breakdown.pst = amount;
        break;
      case 'HST':
        breakdown.hst = amount;
        break;
      case 'QST':
        breakdown.qst = amount;
        break;
    }
  });

  return breakdown;
};

const TaxBreakdownDisplay: React.FC<{
  breakdown: TaxBreakdown;
  showInfo?: boolean;
}> = ({ breakdown, showInfo = false }) => {
  const taxInfo = getTaxInfo(breakdown.province);
  const provinceName =
    CANADIAN_PROVINCES.find(p => p.code === breakdown.province)?.name ||
    breakdown.province;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="currency-cad">{formatCAD(breakdown.subtotal)}</span>
      </div>

      {taxInfo.taxes.map((tax, index) => {
        const amount = breakdown.subtotal * tax.rate;
        return (
          <div
            key={tax.name}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{tax.name}</span>
              <Badge variant="outline" className="text-xs">
                {(tax.rate * 100).toFixed(2)}%
              </Badge>
              {showInfo && (
                <div className="group relative">
                  <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  <div className="absolute bottom-full left-0 z-10 mb-1 hidden group-hover:block">
                    <div className="bg-popover rounded-md border p-2 text-xs whitespace-nowrap shadow-md">
                      {tax.description}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <span className="currency-cad">{formatCAD(amount)}</span>
          </div>
        );
      })}

      <div className="border-t pt-3">
        <div className="flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <span>Total</span>
            <Badge variant="secondary" className="text-xs">
              <MapPin className="mr-1 h-3 w-3" />
              {provinceName}
            </Badge>
          </div>
          <span className="currency-cad text-lg">
            {formatCAD(breakdown.total)}
          </span>
        </div>
      </div>

      {showInfo && (
        <div className="text-muted-foreground bg-muted/50 rounded-lg p-3 text-xs">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <div>
              <p className="mb-1 font-medium">
                Tax Information for {provinceName}
              </p>
              <p>{taxInfo.description}</p>
              <p className="mt-1">
                Total tax rate:{' '}
                <span className="font-medium">
                  {(taxInfo.rate * 100).toFixed(2)}%
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CanadianTaxDisplay: React.FC<CanadianTaxDisplayProps> = ({
  subtotal,
  province,
  showBreakdown = true,
  showInfo = false,
  className,
}) => {
  const breakdown = calculateDetailedTax(subtotal, province);

  if (!showBreakdown) {
    // Simple tax display
    const taxAmount = breakdown.total - breakdown.subtotal;
    return (
      <div className={cn('flex items-center justify-between', className)}>
        <span className="text-muted-foreground">Tax ({province})</span>
        <span className="currency-cad">{formatCAD(taxAmount)}</span>
      </div>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Tax Breakdown
        </CardTitle>
      </CardHeader>

      <CardContent>
        <TaxBreakdownDisplay breakdown={breakdown} showInfo={showInfo} />
      </CardContent>
    </Card>
  );
};

// Province selector component
interface ProvinceSelectProps {
  value: string;
  onChange: (province: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

const ProvinceSelect: React.FC<ProvinceSelectProps> = ({
  value,
  onChange,
  label = 'Province',
  required = false,
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm leading-none font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        required={required}
      >
        <option value="">Select Province</option>
        {CANADIAN_PROVINCES.map(province => (
          <option key={province.code} value={province.code}>
            {province.name}
          </option>
        ))}
      </select>
    </div>
  );
};

// Currency input component for CAD
interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  error?: string;
  helperText?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  label,
  error,
  helperText,
  className,
  ...props
}) => {
  const [displayValue, setDisplayValue] = React.useState(
    value > 0 ? (value / 100).toFixed(2) : ''
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/[^0-9.]/g, '');
    setDisplayValue(inputValue);

    const cents = Math.round(parseFloat(inputValue || '0') * 100);
    onChange(cents);
  };

  const handleBlur = () => {
    if (displayValue && !isNaN(parseFloat(displayValue))) {
      setDisplayValue(parseFloat(displayValue).toFixed(2));
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm leading-none font-medium">
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
          CAD $
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-12 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          placeholder="0.00"
          {...props}
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {helperText && !error && (
        <p className="text-muted-foreground text-sm">{helperText}</p>
      )}
    </div>
  );
};

export {
  CanadianTaxDisplay,
  ProvinceSelect,
  CurrencyInput,
  calculateDetailedTax,
  getTaxInfo,
  type TaxBreakdown,
};
