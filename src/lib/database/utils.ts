/**
 * Database Utility Functions for Canadian E-commerce
 * Includes tax calculations, postal code validation, and data transformations
 */

import { CanadianProvince, TaxType, Prisma } from '@prisma/client'
import { prisma } from './connection'

// Type definitions for Canadian tax calculations
export interface TaxCalculation {
  subtotal: number
  gst: number
  pst: number
  hst: number
  qst: number
  totalTax: number
  grandTotal: number
  breakdown: TaxBreakdownItem[]
}

export interface TaxBreakdownItem {
  type: TaxType
  name: string
  rate: number
  amount: number
}

export interface PostalCodeValidation {
  isValid: boolean
  formatted?: string
  province?: CanadianProvince
}

/**
 * Calculate Canadian taxes for a given province and amount
 */
export async function calculateCanadianTax(
  province: CanadianProvince,
  subtotal: number,
  effectiveDate: Date = new Date()
): Promise<TaxCalculation> {
  // Get active tax rates for the province
  const taxRates = await prisma.taxRate.findMany({
    where: {
      province,
      isActive: true,
      effectiveFrom: {
        lte: effectiveDate,
      },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: effectiveDate } },
      ],
    },
    orderBy: {
      effectiveFrom: 'desc',
    },
  })

  let gst = 0
  let pst = 0
  let hst = 0
  let qst = 0
  const breakdown: TaxBreakdownItem[] = []

  for (const rate of taxRates) {
    const amount = Math.round(subtotal * Number(rate.rate))
    
    switch (rate.taxType) {
      case TaxType.GST:
        gst = amount
        break
      case TaxType.PST:
        pst = amount
        break
      case TaxType.HST:
        hst = amount
        break
      case TaxType.QST:
        qst = amount
        break
    }

    breakdown.push({
      type: rate.taxType,
      name: rate.name,
      rate: Number(rate.rate),
      amount,
    })
  }

  const totalTax = gst + pst + hst + qst
  const grandTotal = subtotal + totalTax

  return {
    subtotal,
    gst,
    pst,
    hst,
    qst,
    totalTax,
    grandTotal,
    breakdown,
  }
}

/**
 * Validate and format Canadian postal codes
 */
export function validateCanadianPostalCode(postalCode: string): PostalCodeValidation {
  // Remove spaces and convert to uppercase
  const cleaned = postalCode.replace(/\s/g, '').toUpperCase()
  
  // Canadian postal code regex: A1A 1A1
  const postalCodeRegex = /^[A-Z]\d[A-Z]\d[A-Z]\d$/
  
  if (!postalCodeRegex.test(cleaned)) {
    return { isValid: false }
  }

  // Format with space: A1A1A1 -> A1A 1A1
  const formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`
  
  // Determine province based on first letter
  const province = getProvinceFromPostalCode(cleaned.charAt(0))

  return {
    isValid: true,
    formatted,
    province,
  }
}

/**
 * Get Canadian province from postal code first letter
 */
function getProvinceFromPostalCode(firstLetter: string): CanadianProvince | undefined {
  const postalCodeMap: Record<string, CanadianProvince> = {
    // Newfoundland and Labrador
    A: CanadianProvince.NL,
    // Nova Scotia
    B: CanadianProvince.NS,
    // Prince Edward Island
    C: CanadianProvince.PE,
    // New Brunswick
    E: CanadianProvince.NB,
    // Quebec (Eastern)
    G: CanadianProvince.QC,
    H: CanadianProvince.QC,
    // Quebec (Western)
    J: CanadianProvince.QC,
    // Ontario (Eastern)
    K: CanadianProvince.ON,
    L: CanadianProvince.ON,
    M: CanadianProvince.ON,
    N: CanadianProvince.ON,
    P: CanadianProvince.ON,
    // Manitoba
    R: CanadianProvince.MB,
    // Saskatchewan
    S: CanadianProvince.SK,
    // Alberta
    T: CanadianProvince.AB,
    // British Columbia
    V: CanadianProvince.BC,
    // Northwest Territories, Nunavut, Yukon
    X: CanadianProvince.NT, // Could also be NU or YT
    Y: CanadianProvince.YT,
  }

  return postalCodeMap[firstLetter]
}

/**
 * Generate unique order number with Canadian format
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `CA${timestamp}${random}`
}

/**
 * Convert cents to dollars for display
 */
export function formatCurrency(cents: number, currency: string = 'CAD'): string {
  const amount = cents / 100
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Convert dollars to cents for storage
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Get paginated results with metadata
 */
export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export async function getPaginatedResults<T>(
  model: any,
  options: PaginationOptions = {},
  where: Prisma.UserWhereInput = {}
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options

  const skip = (page - 1) * limit
  const orderBy = { [sortBy]: sortOrder }

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
    model.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

/**
 * Sanitize and validate email addresses
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Generate secure download URLs with expiration
 */
export function generateSecureDownloadUrl(
  originalUrl: string,
  userId: string,
  expiresInHours: number = 24
): string {
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
  const timestamp = expiresAt.getTime()
  
  // In a real implementation, you'd use a signing mechanism
  // For now, we'll use a simple token-based approach
  const token = Buffer.from(`${userId}:${timestamp}:${originalUrl}`).toString('base64')
  
  return `/api/downloads/secure?token=${token}`
}

/**
 * Validate secure download token
 */
export function validateDownloadToken(token: string): {
  isValid: boolean
  userId?: string
  originalUrl?: string
  expiresAt?: Date
} {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [userId, timestamp, originalUrl] = decoded.split(':')
    
    const expiresAt = new Date(parseInt(timestamp))
    const now = new Date()
    
    if (now > expiresAt) {
      return { isValid: false }
    }

    return {
      isValid: true,
      userId,
      originalUrl,
      expiresAt,
    }
  } catch (error) {
    return { isValid: false }
  }
}

/**
 * Calculate subscription proration for Canadian billing
 */
export function calculateProration(
  currentPrice: number,
  newPrice: number,
  daysRemaining: number,
  billingPeriodDays: number
): number {
  const dailyOldRate = currentPrice / billingPeriodDays
  const dailyNewRate = newPrice / billingPeriodDays
  
  const refundAmount = Math.round(dailyOldRate * daysRemaining)
  const newChargeAmount = Math.round(dailyNewRate * daysRemaining)
  
  return newChargeAmount - refundAmount
}

/**
 * Generate Canadian business number validation
 */
export function validateCanadianBusinessNumber(bn: string): boolean {
  // Remove spaces and hyphens
  const cleaned = bn.replace(/[\s-]/g, '')
  
  // Canadian BN format: 9 digits + 2 letter program identifier + 4 digit reference number
  const bnRegex = /^\d{9}[A-Z]{2}\d{4}$/
  
  return bnRegex.test(cleaned)
}

/**
 * Get Canadian province full name from abbreviation
 */
export function getProvinceFullName(province: CanadianProvince): string {
  const provinceNames: Record<CanadianProvince, string> = {
    [CanadianProvince.AB]: 'Alberta',
    [CanadianProvince.BC]: 'British Columbia',
    [CanadianProvince.MB]: 'Manitoba',
    [CanadianProvince.NB]: 'New Brunswick',
    [CanadianProvince.NL]: 'Newfoundland and Labrador',
    [CanadianProvince.NS]: 'Nova Scotia',
    [CanadianProvince.NT]: 'Northwest Territories',
    [CanadianProvince.NU]: 'Nunavut',
    [CanadianProvince.ON]: 'Ontario',
    [CanadianProvince.PE]: 'Prince Edward Island',
    [CanadianProvince.QC]: 'Quebec',
    [CanadianProvince.SK]: 'Saskatchewan',
    [CanadianProvince.YT]: 'Yukon',
  }

  return provinceNames[province]
}

/**
 * Clean and validate phone numbers for Canadian format
 */
export function formatCanadianPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Canadian phone numbers are 10 digits (without country code) or 11 digits (with country code 1)
  if (digits.length === 10) {
    return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    const number = digits.slice(1)
    return `+1-${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
  }
  
  return null
}