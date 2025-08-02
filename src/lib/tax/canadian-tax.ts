/**
 * Canadian Tax Calculation System
 * Comprehensive GST/HST/PST calculation for all Canadian provinces and territories
 * Compliant with current Canadian tax regulations as of 2024
 */

import { CanadianProvince, TaxType } from '@prisma/client';

export interface TaxBreakdown {
  gst?: { rate: number; amount: number; };
  hst?: { rate: number; amount: number; };
  pst?: { rate: number; amount: number; };
  qst?: { rate: number; amount: number; };
}

export interface TaxCalculation {
  subtotal: number;
  totalTax: number;
  total: number;
  breakdown: TaxBreakdown;
  province: CanadianProvince;
}

export interface CanadianTaxRates {
  province: CanadianProvince;
  gst?: number;      // Federal GST
  pst?: number;      // Provincial PST
  hst?: number;      // Harmonized HST
  qst?: number;      // Quebec QST
  effectiveDate: Date;
  description: string;
}

/**
 * Current Canadian Tax Rates (2024)
 * Updated annually based on provincial budgets
 */
export const CANADIAN_TAX_RATES: Record<CanadianProvince, CanadianTaxRates> = {
  AB: {
    province: 'AB',
    gst: 0.05,
    effectiveDate: new Date('2024-01-01'),
    description: 'Alberta - GST only (5%)'
  },
  BC: {
    province: 'BC',
    gst: 0.05,
    pst: 0.07,
    effectiveDate: new Date('2024-01-01'),
    description: 'British Columbia - GST (5%) + PST (7%)'
  },
  MB: {
    province: 'MB',
    gst: 0.05,
    pst: 0.07,
    effectiveDate: new Date('2024-01-01'),
    description: 'Manitoba - GST (5%) + PST (7%)'
  },
  NB: {
    province: 'NB',
    hst: 0.15,
    effectiveDate: new Date('2024-01-01'),
    description: 'New Brunswick - HST (15%)'
  },
  NL: {
    province: 'NL',
    hst: 0.15,
    effectiveDate: new Date('2024-01-01'),
    description: 'Newfoundland and Labrador - HST (15%)'
  },
  NS: {
    province: 'NS',
    hst: 0.15,
    effectiveDate: new Date('2024-01-01'),
    description: 'Nova Scotia - HST (15%)'
  },
  ON: {
    province: 'ON',
    hst: 0.13,
    effectiveDate: new Date('2024-01-01'),
    description: 'Ontario - HST (13%)'
  },
  PE: {
    province: 'PE',
    hst: 0.15,
    effectiveDate: new Date('2024-01-01'),
    description: 'Prince Edward Island - HST (15%)'
  },
  QC: {
    province: 'QC',
    gst: 0.05,
    qst: 0.09975,
    effectiveDate: new Date('2024-01-01'),
    description: 'Quebec - GST (5%) + QST (9.975%)'
  },
  SK: {
    province: 'SK',
    gst: 0.05,
    pst: 0.06,
    effectiveDate: new Date('2024-01-01'),
    description: 'Saskatchewan - GST (5%) + PST (6%)'
  },
  NT: {
    province: 'NT',
    gst: 0.05,
    effectiveDate: new Date('2024-01-01'),
    description: 'Northwest Territories - GST only (5%)'
  },
  NU: {
    province: 'NU',
    gst: 0.05,
    effectiveDate: new Date('2024-01-01'),
    description: 'Nunavut - GST only (5%)'
  },
  YT: {
    province: 'YT',
    gst: 0.05,
    effectiveDate: new Date('2024-01-01'),
    description: 'Yukon - GST only (5%)'
  }
};

/**
 * Digital Product Tax Exemptions
 * Some digital products may be exempt from certain provincial taxes
 */
export const DIGITAL_PRODUCT_EXEMPTIONS: Record<CanadianProvince, string[]> = {
  AB: [],
  BC: [],
  MB: [],
  NB: [],
  NL: [],
  NS: [],
  ON: [],
  PE: [],
  QC: [],
  SK: [],
  NT: [],
  NU: [],
  YT: []
};

/**
 * Calculate Canadian taxes based on province and product type
 */
export function calculateCanadianTax(
  subtotal: number,
  province: CanadianProvince,
  productType: 'DIGITAL' | 'PHYSICAL' | 'SUBSCRIPTION' = 'DIGITAL'
): TaxCalculation {
  if (subtotal <= 0) {
    return {
      subtotal,
      totalTax: 0,
      total: subtotal,
      breakdown: {},
      province
    };
  }

  const rates = CANADIAN_TAX_RATES[province];
  if (!rates) {
    throw new Error(`Tax rates not found for province: ${province}`);
  }

  const breakdown: TaxBreakdown = {};
  let totalTax = 0;

  // Calculate taxes based on province structure
  if (rates.hst) {
    // HST provinces (NB, NL, NS, ON, PE)
    const hstAmount = Math.round(subtotal * rates.hst);
    breakdown.hst = { rate: rates.hst, amount: hstAmount };
    totalTax += hstAmount;
  } else {
    // Non-HST provinces - calculate GST and provincial taxes separately
    
    // Federal GST (applies to all provinces)
    if (rates.gst) {
      const gstAmount = Math.round(subtotal * rates.gst);
      breakdown.gst = { rate: rates.gst, amount: gstAmount };
      totalTax += gstAmount;
    }

    // Provincial Sales Tax (PST)
    if (rates.pst) {
      const pstAmount = Math.round(subtotal * rates.pst);
      breakdown.pst = { rate: rates.pst, amount: pstAmount };
      totalTax += pstAmount;
    }

    // Quebec Sales Tax (QST) - calculated on GST-inclusive amount
    if (rates.qst) {
      // QST is calculated on the subtotal + GST
      const qstBase = subtotal + (breakdown.gst?.amount || 0);
      const qstAmount = Math.round(qstBase * rates.qst);
      breakdown.qst = { rate: rates.qst, amount: qstAmount };
      totalTax += qstAmount;
    }
  }

  return {
    subtotal,
    totalTax,
    total: subtotal + totalTax,
    breakdown,
    province
  };
}

/**
 * Calculate tax for multiple line items
 */
export function calculateLineItemTaxes(
  items: Array<{
    subtotal: number;
    productType: 'DIGITAL' | 'PHYSICAL' | 'SUBSCRIPTION';
  }>,
  province: CanadianProvince
): TaxCalculation {
  const totalSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  
  // For simplicity, calculate on total amount
  // In complex scenarios, you might need per-item calculations
  return calculateCanadianTax(totalSubtotal, province);
}

/**
 * Validate tax calculation for audit purposes
 */
export function validateTaxCalculation(calculation: TaxCalculation): boolean {
  const { subtotal, totalTax, total, breakdown } = calculation;

  // Basic validation
  if (total !== subtotal + totalTax) {
    return false;
  }

  // Validate breakdown totals
  const breakdownTotal = Object.values(breakdown).reduce(
    (sum, tax) => sum + (tax?.amount || 0), 
    0
  );

  if (Math.abs(breakdownTotal - totalTax) > 1) { // Allow 1 cent rounding difference
    return false;
  }

  return true;
}

/**
 * Format tax amount for display
 */
export function formatTaxAmount(amountInCents: number): string {
  return `$${(amountInCents / 100).toFixed(2)} CAD`;
}

/**
 * Generate tax summary for receipts/invoices
 */
export function generateTaxSummary(calculation: TaxCalculation): string[] {
  const summary: string[] = [];
  const { breakdown } = calculation;

  if (breakdown.hst) {
    summary.push(`HST (${(breakdown.hst.rate * 100).toFixed(1)}%): ${formatTaxAmount(breakdown.hst.amount)}`);
  } else {
    if (breakdown.gst) {
      summary.push(`GST (${(breakdown.gst.rate * 100).toFixed(1)}%): ${formatTaxAmount(breakdown.gst.amount)}`);
    }
    if (breakdown.pst) {
      summary.push(`PST (${(breakdown.pst.rate * 100).toFixed(1)}%): ${formatTaxAmount(breakdown.pst.amount)}`);
    }
    if (breakdown.qst) {
      summary.push(`QST (${(breakdown.qst.rate * 100).toFixed(3)}%): ${formatTaxAmount(breakdown.qst.amount)}`);
    }
  }

  summary.push(`Total Tax: ${formatTaxAmount(calculation.totalTax)}`);
  return summary;
}

/**
 * Get tax rate information for a province
 */
export function getProvinceTaxInfo(province: CanadianProvince): CanadianTaxRates {
  const rates = CANADIAN_TAX_RATES[province];
  if (!rates) {
    throw new Error(`Tax information not found for province: ${province}`);
  }
  return rates;
}

/**
 * Calculate effective tax rate for a province
 */
export function getEffectiveTaxRate(province: CanadianProvince): number {
  const rates = CANADIAN_TAX_RATES[province];
  
  if (rates.hst) {
    return rates.hst;
  }
  
  let effectiveRate = rates.gst || 0;
  effectiveRate += rates.pst || 0;
  
  // For Quebec, QST is calculated on GST-inclusive amount
  if (rates.qst) {
    effectiveRate += rates.qst * (1 + (rates.gst || 0));
  }
  
  return effectiveRate;
}

/**
 * Determine if a product is tax-exempt in a province
 */
export function isProductTaxExempt(
  productType: 'DIGITAL' | 'PHYSICAL' | 'SUBSCRIPTION',
  province: CanadianProvince
): boolean {
  // Currently, most digital products are taxable in Canada
  // This function exists for future exemption rules
  const exemptions = DIGITAL_PRODUCT_EXEMPTIONS[province];
  return exemptions.includes(productType);
}

/**
 * Generate tax breakdown for Stripe metadata
 */
export function generateStripeMetadata(calculation: TaxCalculation): Record<string, string> {
  const metadata: Record<string, string> = {
    tax_province: calculation.province,
    tax_subtotal: calculation.subtotal.toString(),
    tax_total: calculation.totalTax.toString(),
    tax_calculation_date: new Date().toISOString()
  };

  if (calculation.breakdown.hst) {
    metadata.hst_rate = (calculation.breakdown.hst.rate * 100).toFixed(2);
    metadata.hst_amount = calculation.breakdown.hst.amount.toString();
  }

  if (calculation.breakdown.gst) {
    metadata.gst_rate = (calculation.breakdown.gst.rate * 100).toFixed(2);
    metadata.gst_amount = calculation.breakdown.gst.amount.toString();
  }

  if (calculation.breakdown.pst) {
    metadata.pst_rate = (calculation.breakdown.pst.rate * 100).toFixed(2);
    metadata.pst_amount = calculation.breakdown.pst.amount.toString();
  }

  if (calculation.breakdown.qst) {
    metadata.qst_rate = (calculation.breakdown.qst.rate * 100).toFixed(3);
    metadata.qst_amount = calculation.breakdown.qst.amount.toString();
  }

  return metadata;
}

/**
 * Store tax calculation in database format
 */
export function prepareTaxBreakdownForDb(calculation: TaxCalculation): any {
  return {
    province: calculation.province,
    subtotal: calculation.subtotal,
    totalTax: calculation.totalTax,
    total: calculation.total,
    breakdown: calculation.breakdown,
    calculatedAt: new Date(),
    effectiveRates: CANADIAN_TAX_RATES[calculation.province]
  };
}

/**
 * Utility function to get province from postal code
 * Basic implementation - in production, you might use a more comprehensive service
 */
export function getProvinceFromPostalCode(postalCode: string): CanadianProvince | null {
  const cleanPostalCode = postalCode.replace(/\s+/g, '').toUpperCase();
  
  if (cleanPostalCode.length < 1) return null;

  const firstChar = cleanPostalCode.charAt(0);
  
  const postalCodeMap: Record<string, CanadianProvince> = {
    'A': 'NL', // Newfoundland and Labrador
    'B': 'NS', // Nova Scotia
    'C': 'PE', // Prince Edward Island
    'E': 'NB', // New Brunswick
    'G': 'QC', // Quebec (Eastern)
    'H': 'QC', // Quebec (Metropolitan)
    'J': 'QC', // Quebec (Western)
    'K': 'ON', // Ontario (Eastern)
    'L': 'ON', // Ontario (Central)
    'M': 'ON', // Ontario (Toronto)
    'N': 'ON', // Ontario (Southwestern)
    'P': 'ON', // Ontario (Northern)
    'R': 'MB', // Manitoba
    'S': 'SK', // Saskatchewan
    'T': 'AB', // Alberta
    'V': 'BC', // British Columbia
    'X': 'NT', // Northwest Territories and Nunavut
    'Y': 'YT'  // Yukon
  };

  return postalCodeMap[firstChar] || null;
}

export default {
  calculateCanadianTax,
  calculateLineItemTaxes,
  validateTaxCalculation,
  formatTaxAmount,
  generateTaxSummary,
  getProvinceTaxInfo,
  getEffectiveTaxRate,
  isProductTaxExempt,
  generateStripeMetadata,
  prepareTaxBreakdownForDb,
  getProvinceFromPostalCode,
  CANADIAN_TAX_RATES
};