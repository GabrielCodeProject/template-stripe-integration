# UI/UX Components Guide

## NextJS Stripe Payment Template - Shadcn UI Components

This comprehensive guide covers all the UI/UX components designed for the NextJS Stripe Payment Template using Shadcn UI, specifically optimized for Canadian SaaS and e-commerce businesses.

## Table of Contents

1. [Design System](#design-system)
2. [Base Components](#base-components)
3. [Customer-Facing Components](#customer-facing-components)
4. [Admin Dashboard Components](#admin-dashboard-components)
5. [Authentication Components](#authentication-components)
6. [Payment Components](#payment-components)
7. [Support Components](#support-components)
8. [Layout & Responsive Components](#layout--responsive-components)
9. [Error Handling Components](#error-handling-components)
10. [Canadian-Specific Components](#canadian-specific-components)
11. [Accessibility Features](#accessibility-features)
12. [Usage Examples](#usage-examples)

---

## Design System

### Color Palette

The design system uses HSL colors for better theme support:

- **Primary**: Blue-based palette for primary actions and branding
- **Success**: Green for positive states (payments, active subscriptions)
- **Warning**: Orange for attention states (past due, canceling)
- **Destructive**: Red for errors and destructive actions
- **Muted**: Gray scale for secondary content and borders
- **Canadian Red**: For Canadian-specific branding elements

### Typography Scale

```css
.text-h1     /* 4xl/5xl - Page headings */
.text-h2     /* 3xl/4xl - Section headings */
.text-h3     /* 2xl/3xl - Subsection headings */
.text-h4     /* xl/2xl - Component headings */
.text-body-large  /* lg - Large body text */
.text-body        /* base - Default body text */
.text-body-small  /* sm - Small body text */
.text-caption     /* xs - Caption and meta text */
```

### Spacing & Layout

- **Grid Layouts**: Responsive grid systems with 1-4 columns
- **Stack Layouts**: Flexible spacing with xs/sm/md/lg/xl options
- **Container Sizes**: sm/md/lg/xl/full with responsive padding

---

## Base Components

### Button

Versatile button component with multiple variants and states.

```typescript
import { Button } from "@/components/ui/button";

// Variants
<Button variant="default">Primary Action</Button>
<Button variant="outline">Secondary Action</Button>
<Button variant="ghost">Subtle Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="success">Confirm Payment</Button>
<Button variant="warning">Attention Required</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>

// States
<Button loading={true}>Processing...</Button>
<Button disabled>Disabled</Button>
```

### Input

Enhanced input component with validation and accessibility features.

```typescript
import { Input } from "@/components/ui/input";

<Input
  label="Email Address"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
  required
  helperText="We'll never share your email"
/>
```

### Card

Flexible card component for content organization.

```typescript
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Payment Summary</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content here */}
  </CardContent>
</Card>
```

### Badge

Status indicators with payment and subscription-specific variants.

```typescript
import { Badge } from "@/components/ui/badge";

// Payment status badges
<Badge variant="paid">Paid</Badge>
<Badge variant="pending">Pending</Badge>
<Badge variant="failed">Failed</Badge>

// Subscription status badges
<Badge variant="active">Active</Badge>
<Badge variant="past_due">Past Due</Badge>
<Badge variant="cancelled">Cancelled</Badge>
```

---

## Customer-Facing Components

### ProductCard

Feature-rich product display card with Canadian pricing.

```typescript
import { ProductCard } from "@/components/customer/product-card";

<ProductCard
  id="product-1"
  name="Premium Workout Plan"
  description="Complete 12-week transformation program"
  price={9999} // in cents
  originalPrice={14999}
  image="/images/workout-plan.jpg"
  category="Fitness"
  rating={4.8}
  reviewCount={124}
  isDigital={true}
  isOnSale={true}
  onAddToCart={(id) => handleAddToCart(id)}
  onViewDetails={(id) => router.push(`/products/${id}`)}
/>
```

### ProductCatalog

Complete product browsing experience with search and filtering.

```typescript
import { ProductCatalog } from "@/components/customer/product-catalog";

<ProductCatalog
  products={products}
  isLoading={isLoading}
  searchQuery={searchQuery}
  selectedCategory={selectedCategory}
  categories={["Supplements", "Workout Plans", "Nutrition"]}
  onSearchChange={setSearchQuery}
  onCategoryChange={setSelectedCategory}
  onAddToCart={handleAddToCart}
  onViewDetails={handleViewDetails}
/>
```

### ShoppingCart

Full-featured shopping cart with Canadian tax calculation.

```typescript
import { ShoppingCart } from "@/components/customer/shopping-cart";

<ShoppingCart
  items={cartItems}
  subtotal={subtotal}
  tax={calculateTax(subtotal, province)}
  total={subtotal + tax}
  province={province}
  onUpdateQuantity={handleUpdateQuantity}
  onRemoveItem={handleRemoveItem}
  onCheckout={handleCheckout}
/>
```

### CheckoutForm

Canadian-compliant checkout form with address validation.

```typescript
import { CheckoutForm } from "@/components/customer/checkout-form";

<CheckoutForm
  subtotal={subtotal}
  tax={tax}
  total={total}
  onSubmit={handleCheckoutSubmit}
/>
```

---

## Admin Dashboard Components

### DashboardOverview

Comprehensive analytics dashboard with revenue metrics.

```typescript
import { DashboardOverview } from "@/components/admin/dashboard-overview";

const dashboardData = {
  metrics: {
    totalRevenue: 125000,
    monthlyRevenue: 15000,
    totalCustomers: 1250,
    activeSubscriptions: 890,
    averageOrderValue: 65.50,
    conversionRate: 3.2
  },
  changes: {
    revenue: { value: 12, trend: 'up' },
    customers: { value: 8, trend: 'up' },
    subscriptions: { value: 5, trend: 'up' },
    aov: { value: 2, trend: 'down' }
  },
  recentSales: [...],
  topProducts: [...]
};

<DashboardOverview data={dashboardData} />
```

### ProductManagement

Admin interface for managing products and inventory.

```typescript
import { ProductManagement } from "@/components/admin/product-management";

<ProductManagement
  products={products}
  categories={categories}
  onCreateProduct={() => router.push('/admin/products/new')}
  onEditProduct={(id) => router.push(`/admin/products/${id}/edit`)}
  onDeleteProduct={handleDeleteProduct}
/>
```

---

## Authentication Components

### LoginForm

Secure login form with validation and accessibility.

```typescript
import { LoginForm } from "@/components/auth/login-form";

<LoginForm
  onSubmit={handleLogin}
  onForgotPassword={handleForgotPassword}
  onSignUp={() => router.push('/signup')}
  error={loginError}
  isLoading={isLoading}
/>
```

### RoleGuard

Role-based access control component.

```typescript
import { RoleGuard } from "@/components/auth/role-guard";

<RoleGuard
  allowedRoles={['admin', 'support']}
  user={currentUser}
  onLogin={() => router.push('/login')}
>
  <AdminDashboard />
</RoleGuard>
```

---

## Payment Components

### PaymentForm

Stripe-integrated payment form with multiple payment methods.

```typescript
import { PaymentForm } from "@/components/payment/payment-form";

<PaymentForm
  amount={5000} // $50.00 in cents
  description="Pro Plan Subscription"
  paymentMethods={savedPaymentMethods}
  onSubmit={handlePayment}
  onAddPaymentMethod={handleAddPaymentMethod}
/>
```

### SubscriptionManagement

Complete subscription management interface.

```typescript
import { SubscriptionManagement } from "@/components/payment/subscription-management";

<SubscriptionManagement
  subscription={currentSubscription}
  onUpgrade={handleUpgrade}
  onCancel={handleCancel}
  onUpdatePaymentMethod={handleUpdatePayment}
/>
```

---

## Support Components

### CustomerLookup

Support tool for finding and managing customers.

```typescript
import { CustomerLookup } from "@/components/support/customer-lookup";

<CustomerLookup
  onCustomerSelect={handleCustomerSelect}
  onCreateTicket={handleCreateTicket}
  onViewOrders={handleViewOrders}
  onRefund={handleRefund}
/>
```

---

## Layout & Responsive Components

### ResponsiveLayout

Main layout component with responsive sidebar and header.

```typescript
import { ResponsiveLayout, PageHeader } from "@/components/ui/responsive-layout";

<ResponsiveLayout
  header={<Header />}
  sidebar={<Sidebar />}
  footer={<Footer />}
>
  <PageHeader
    title="Dashboard"
    description="Overview of your business metrics"
    breadcrumbs={[
      { label: "Home", href: "/" },
      { label: "Dashboard" }
    ]}
    actions={
      <Button onClick={handleExport}>Export Data</Button>
    }
  />
  {/* Page content */}
</ResponsiveLayout>
```

### GridLayout & Stack

Flexible layout components for organizing content.

```typescript
import { GridLayout, Stack } from "@/components/ui/responsive-layout";

<GridLayout columns={3} gap="lg">
  <MetricCard />
  <MetricCard />
  <MetricCard />
</GridLayout>

<Stack direction="horizontal" spacing="md" align="center">
  <Button>Save</Button>
  <Button variant="outline">Cancel</Button>
</Stack>
```

---

## Error Handling Components

### ErrorBoundary

Comprehensive error handling with development debugging.

```typescript
import { ErrorBoundary } from "@/components/ui/error-boundary";

<ErrorBoundary
  fallback={CustomErrorFallback}
  onError={(error, errorInfo) => {
    console.error('Error caught:', error);
    // Send to error reporting service
  }}
  level="page"
>
  <App />
</ErrorBoundary>
```

### NotFound & ApiError

Specialized error components for common scenarios.

```typescript
import { NotFound, ApiError } from "@/components/ui/error-boundary";

// 404 Page
<NotFound
  title="Page Not Found"
  description="The page you're looking for doesn't exist."
  showHomeButton={true}
/>

// API Error
<ApiError
  error={{ status: 500, message: "Server error" }}
  onRetry={handleRetry}
  showSupport={true}
/>
```

---

## Canadian-Specific Components

### CanadianTaxDisplay

Detailed tax breakdown for Canadian provinces.

```typescript
import { CanadianTaxDisplay } from "@/components/ui/canadian-tax-display";

<CanadianTaxDisplay
  subtotal={10000} // $100.00 in cents
  province="ON"
  showBreakdown={true}
  showInfo={true}
/>
```

### ProvinceSelect & CurrencyInput

Canadian-specific form components.

```typescript
import { ProvinceSelect, CurrencyInput } from "@/components/ui/canadian-tax-display";

<ProvinceSelect
  value={province}
  onChange={setProvince}
  label="Province/Territory"
  required
/>

<CurrencyInput
  value={price} // in cents
  onChange={setPrice}
  label="Price (CAD)"
  helperText="Enter price in Canadian dollars"
/>
```

---

## Accessibility Features

All components include comprehensive accessibility features:

### Keyboard Navigation
- Full keyboard support for all interactive elements
- Proper tab order and focus management
- Escape key handling for modals and dropdowns

### Screen Reader Support
- Semantic HTML structure
- ARIA labels and descriptions
- Live regions for dynamic content updates
- Role attributes for complex components

### Visual Accessibility
- High contrast color combinations
- Focus indicators that meet WCAG standards
- Scalable text and responsive design
- Color-blind friendly status indicators

### Form Accessibility
- Associated labels for all form fields
- Error message announcements
- Required field indicators
- Input validation with descriptive errors

---

## Usage Examples

### Complete E-commerce Page

```typescript
import {
  ResponsiveLayout,
  PageHeader,
  ProductCatalog,
  ErrorBoundary,
  CanadianTaxDisplay
} from "@/components/ui";

export default function ProductsPage() {
  return (
    <ErrorBoundary level="page">
      <ResponsiveLayout
        header={<Header />}
        sidebar={<Sidebar />}
      >
        <PageHeader
          title="Products"
          description="Browse our collection of fitness products"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Products" }
          ]}
        />
        
        <ProductCatalog
          products={products}
          categories={categories}
          onAddToCart={handleAddToCart}
          onViewDetails={handleViewDetails}
        />
      </ResponsiveLayout>
    </ErrorBoundary>
  );
}
```

### Admin Dashboard

```typescript
import {
  ResponsiveLayout,
  PageHeader,
  DashboardOverview,
  RoleGuard
} from "@/components/ui";

export default function AdminDashboard() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <ResponsiveLayout
        header={<AdminHeader />}
        sidebar={<AdminSidebar />}
      >
        <PageHeader
          title="Dashboard"
          description="Business metrics and analytics"
          actions={
            <Button onClick={handleExport}>
              Export Report
            </Button>
          }
        />
        
        <DashboardOverview data={dashboardData} />
      </ResponsiveLayout>
    </RoleGuard>
  );
}
```

### Checkout Flow

```typescript
import {
  Container,
  Stack,
  ShoppingCart,
  CheckoutForm,
  PaymentForm,
  CanadianTaxDisplay
} from "@/components/ui";

export default function CheckoutPage() {
  return (
    <Container size="lg">
      <Stack direction="vertical" spacing="xl">
        <PageHeader title="Checkout" />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Stack direction="vertical" spacing="lg">
            <CheckoutForm
              subtotal={subtotal}
              tax={tax}
              total={total}
              onSubmit={handleCheckout}
            />
            
            <PaymentForm
              amount={total}
              onSubmit={handlePayment}
            />
          </Stack>
          
          <Stack direction="vertical" spacing="lg">
            <ShoppingCart
              items={cartItems}
              subtotal={subtotal}
              tax={tax}
              total={total}
              province={province}
            />
            
            <CanadianTaxDisplay
              subtotal={subtotal}
              province={province}
              showBreakdown={true}
              showInfo={true}
            />
          </Stack>
        </div>
      </Stack>
    </Container>
  );
}
```

---

## Best Practices

### Performance
- Components use React.memo for optimization
- Lazy loading for heavy components
- Skeleton loading states for better UX
- Image optimization with Next.js Image component

### Responsive Design
- Mobile-first approach
- Flexible grid systems
- Touch-friendly interfaces
- Responsive typography

### Canadian Compliance
- Proper tax calculations for all provinces
- CAD currency formatting
- Bilingual support ready (English/French)
- PIPEDA privacy considerations

### Security
- Input validation and sanitization
- XSS protection
- Secure payment handling through Stripe
- Role-based access control

---

This comprehensive component library provides everything needed to build a production-ready Canadian payment application with modern UX, accessibility compliance, and responsive design.