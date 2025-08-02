import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Canadian currency formatter
export function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2
  }).format(amount);
}

// Canadian tax calculator
export function calculateTax(amount: number, province: string): number {
  const taxRates: Record<string, number> = {
    'AB': 0.05, // GST only
    'BC': 0.12, // GST + PST
    'MB': 0.12, // GST + PST
    'NB': 0.15, // HST
    'NL': 0.15, // HST
    'NS': 0.15, // HST
    'ON': 0.13, // HST
    'PE': 0.15, // HST
    'QC': 0.14975, // GST + QST
    'SK': 0.11, // GST + PST
    'NT': 0.05, // GST only
    'NU': 0.05, // GST only
    'YT': 0.05  // GST only
  };
  
  return amount * (taxRates[province] || 0.13); // Default to ON HST
}

// Format subscription interval
export function formatInterval(interval: string, count?: number): string {
  const plural = count && count > 1 ? 's' : '';
  const prefix = count && count > 1 ? `${count} ` : '';
  
  switch (interval) {
    case 'day':
      return `${prefix}day${plural}`;
    case 'week':
      return `${prefix}week${plural}`;
    case 'month':
      return `${prefix}month${plural}`;
    case 'year':
      return `${prefix}year${plural}`;
    default:
      return interval;
  }
}

// Truncate text with ellipsis
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + '...';
}

// Generate initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}