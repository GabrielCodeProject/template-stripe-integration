// Base UI Components
export { Button, buttonVariants } from './button';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './card';
export { Input } from './input';
export { Badge, badgeVariants } from './badge';
export { LoadingSpinner, Skeleton, PageLoader } from './loading-spinner';

// Customer Components
export { ProductCard } from '../customer/product-card';
export { ProductCatalog } from '../customer/product-catalog';
export { ShoppingCart } from '../customer/shopping-cart';
export { CheckoutForm, CANADIAN_PROVINCES } from '../customer/checkout-form';

// Admin Components
export { DashboardOverview, MetricCard } from '../admin/dashboard-overview';
export { ProductManagement } from '../admin/product-management';

// Authentication Components
export { LoginForm } from '../auth/login-form';
export { RoleGuard, PermissionGuard, withRoleGuard } from '../auth/role-guard';

// Payment Components
export { PaymentForm, CreditCardForm } from '../payment/payment-form';
export { SubscriptionManagement } from '../payment/subscription-management';

// Support Components
export { CustomerLookup } from '../support/customer-lookup';

// Layout & Responsive Components
export {
  ResponsiveLayout,
  PageHeader,
  GridLayout,
  Stack,
  Container,
  useBreakpoint,
  useMediaQuery,
} from './responsive-layout';

// Error Handling Components
export {
  ErrorBoundary,
  DefaultErrorFallback,
  NotFound,
  ApiError,
  NetworkError,
  useErrorHandler,
} from './error-boundary';

// Canadian-specific Components
export {
  CanadianTaxDisplay,
  ProvinceSelect,
  CurrencyInput,
  calculateDetailedTax,
  getTaxInfo,
} from './canadian-tax-display';

// Types
export type { ButtonProps } from './button';
export type { InputProps } from './input';
export type { BadgeProps } from './badge';
export type { ProductCardProps } from '../customer/product-card';
export type { Product } from '../customer/product-catalog';
export type { CartItem } from '../customer/shopping-cart';
export type { CheckoutFormData } from '../customer/checkout-form';
export type {
  DashboardData,
  MetricCardProps,
} from '../admin/dashboard-overview';
export type { LoginCredentials } from '../auth/login-form';
export type { User, UserRole } from '../auth/role-guard';
export type { PaymentData, PaymentMethod } from '../payment/payment-form';
export type { Subscription } from '../payment/subscription-management';
export type { Customer } from '../support/customer-lookup';
export type { TaxBreakdown } from './canadian-tax-display';
export type {
  ResponsiveLayoutProps,
  PageHeaderProps,
  GridLayoutProps,
  StackProps,
  ContainerProps,
} from './responsive-layout';
export type {
  ErrorBoundaryProps,
  ErrorFallbackProps,
  NotFoundProps,
  ApiErrorProps,
} from './error-boundary';
