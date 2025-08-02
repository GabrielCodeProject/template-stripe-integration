'use client';

import * as React from 'react';
import { useState } from 'react';

import {
  ResponsiveLayout,
  PageHeader,
  Container,
  Stack,
  GridLayout,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  ProductCard,
  ShoppingCart,
  CanadianTaxDisplay,
  DashboardOverview,
  PaymentForm,
  SubscriptionManagement,
  ErrorBoundary,
  LoadingSpinner,
} from '@/components/ui';

// Mock data
const mockProducts = [
  {
    id: '1',
    name: 'Premium Whey Protein',
    description:
      'High-quality whey protein isolate for muscle building and recovery',
    price: 5999, // $59.99
    originalPrice: 7999,
    image: '/placeholder-product.jpg',
    category: 'Supplements',
    rating: 4.8,
    reviewCount: 234,
    isDigital: false,
    isOnSale: true,
    isNew: false,
  },
  {
    id: '2',
    name: '12-Week Transformation Plan',
    description:
      'Complete digital workout and nutrition guide for body transformation',
    price: 9999, // $99.99
    image: '/placeholder-digital.jpg',
    category: 'Workout Plans',
    rating: 4.9,
    reviewCount: 156,
    isDigital: true,
    isOnSale: false,
    isNew: true,
  },
];

const mockCartItems = [
  {
    id: '1',
    name: 'Premium Whey Protein',
    price: 5999,
    originalPrice: 7999,
    image: '/placeholder-product.jpg',
    category: 'Supplements',
    quantity: 2,
    isDigital: false,
  },
];

const mockDashboardData = {
  metrics: {
    totalRevenue: 125000,
    monthlyRevenue: 15000,
    totalCustomers: 1250,
    activeSubscriptions: 890,
    averageOrderValue: 65.5,
    conversionRate: 3.2,
  },
  changes: {
    revenue: { value: 12, trend: 'up' as const },
    customers: { value: 8, trend: 'up' as const },
    subscriptions: { value: 5, trend: 'up' as const },
    aov: { value: 2, trend: 'down' as const },
  },
  recentSales: [
    {
      customer: { name: 'John Doe', email: 'john@example.com' },
      amount: 99.99,
      product: 'Transformation Plan',
      date: '2024-01-20',
    },
  ],
  topProducts: [
    {
      name: 'Premium Whey Protein',
      sales: 145,
      revenue: 8695,
      change: 12,
    },
  ],
};

const mockSubscription = {
  id: 'sub_1',
  status: 'active' as const,
  currentPeriodStart: '2024-01-01',
  currentPeriodEnd: '2024-02-01',
  cancelAtPeriodEnd: false,
  plan: {
    id: 'plan_1',
    name: 'Pro Plan',
    amount: 2999, // $29.99
    currency: 'CAD',
    interval: 'month',
    intervalCount: 1,
  },
  paymentMethod: {
    type: 'card',
    last4: '4242',
    brand: 'Visa',
  },
  nextInvoice: {
    date: '2024-02-01',
    amount: 2999,
  },
};

export default function DemoPage() {
  const [selectedTab, setSelectedTab] = useState('components');
  const [isLoading, setIsLoading] = useState(false);

  const tabs = [
    { id: 'components', label: 'Base Components' },
    { id: 'customer', label: 'Customer Components' },
    { id: 'admin', label: 'Admin Dashboard' },
    { id: 'payment', label: 'Payment & Subscription' },
    { id: 'canadian', label: 'Canadian Features' },
  ];

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'components':
        return (
          <Stack direction="vertical" spacing="xl">
            <Card>
              <CardHeader>
                <CardTitle>Base UI Components</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack direction="vertical" spacing="lg">
                  {/* Buttons */}
                  <div>
                    <h4 className="text-h4 mb-4">Buttons</h4>
                    <Stack direction="horizontal" spacing="md" wrap>
                      <Button variant="default">Primary</Button>
                      <Button variant="outline">Secondary</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="destructive">Delete</Button>
                      <Button variant="success">Success</Button>
                      <Button variant="warning">Warning</Button>
                      <Button
                        loading={isLoading}
                        onClick={() => {
                          setIsLoading(true);
                          setTimeout(() => setIsLoading(false), 2000);
                        }}
                      >
                        Test Loading
                      </Button>
                    </Stack>
                  </div>

                  {/* Badges */}
                  <div>
                    <h4 className="text-h4 mb-4">Badges</h4>
                    <Stack direction="horizontal" spacing="md" wrap>
                      <Badge variant="default">Default</Badge>
                      <Badge variant="success">Success</Badge>
                      <Badge variant="warning">Warning</Badge>
                      <Badge variant="destructive">Error</Badge>
                      <Badge variant="paid">Paid</Badge>
                      <Badge variant="pending">Pending</Badge>
                      <Badge variant="active">Active</Badge>
                      <Badge variant="past_due">Past Due</Badge>
                    </Stack>
                  </div>

                  {/* Loading States */}
                  <div>
                    <h4 className="text-h4 mb-4">Loading States</h4>
                    <Stack direction="horizontal" spacing="lg" align="center">
                      <LoadingSpinner size="sm" />
                      <LoadingSpinner size="md" />
                      <LoadingSpinner size="lg" text="Loading..." />
                    </Stack>
                  </div>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        );

      case 'customer':
        return (
          <Stack direction="vertical" spacing="xl">
            {/* Product Cards */}
            <Card>
              <CardHeader>
                <CardTitle>Product Display</CardTitle>
              </CardHeader>
              <CardContent>
                <GridLayout columns={2} gap="lg">
                  {mockProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      {...product}
                      onAddToCart={id => console.log('Add to cart:', id)}
                      onViewDetails={id => console.log('View details:', id)}
                    />
                  ))}
                </GridLayout>
              </CardContent>
            </Card>

            {/* Shopping Cart */}
            <Card>
              <CardHeader>
                <CardTitle>Shopping Cart</CardTitle>
              </CardHeader>
              <CardContent>
                <ShoppingCart
                  items={mockCartItems}
                  subtotal={11998} // $119.98
                  tax={1560} // 13% HST Ontario
                  total={13558}
                  province="ON"
                  onUpdateQuantity={(id, qty) =>
                    console.log('Update qty:', id, qty)
                  }
                  onRemoveItem={id => console.log('Remove:', id)}
                  onCheckout={() => console.log('Checkout')}
                />
              </CardContent>
            </Card>
          </Stack>
        );

      case 'admin':
        return (
          <Stack direction="vertical" spacing="xl">
            <DashboardOverview data={mockDashboardData} />
          </Stack>
        );

      case 'payment':
        return (
          <GridLayout columns={2} gap="xl">
            {/* Payment Form */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Form</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentForm
                  amount={2999}
                  description="Pro Plan Subscription"
                  onSubmit={data => console.log('Payment:', data)}
                />
              </CardContent>
            </Card>

            {/* Subscription Management */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
              </CardHeader>
              <CardContent>
                <SubscriptionManagement
                  subscription={mockSubscription}
                  onUpgrade={() => console.log('Upgrade')}
                  onCancel={() => console.log('Cancel')}
                  onUpdatePaymentMethod={() => console.log('Update payment')}
                />
              </CardContent>
            </Card>
          </GridLayout>
        );

      case 'canadian':
        return (
          <GridLayout columns={2} gap="xl">
            {/* Tax Display */}
            <CanadianTaxDisplay
              subtotal={10000} // $100.00
              province="ON"
              showBreakdown={true}
              showInfo={true}
            />

            {/* Different Province */}
            <CanadianTaxDisplay
              subtotal={10000} // $100.00
              province="QC"
              showBreakdown={true}
              showInfo={true}
            />

            {/* Alberta (GST only) */}
            <CanadianTaxDisplay
              subtotal={10000} // $100.00
              province="AB"
              showBreakdown={true}
              showInfo={true}
            />

            {/* Nova Scotia (HST) */}
            <CanadianTaxDisplay
              subtotal={10000} // $100.00
              province="NS"
              showBreakdown={true}
              showInfo={true}
            />
          </GridLayout>
        );

      default:
        return null;
    }
  };

  return (
    <ErrorBoundary level="page">
      <ResponsiveLayout
        header={
          <div className="flex w-full items-center justify-between">
            <h1 className="text-xl font-semibold">Component Demo</h1>
            <Badge variant="outline">v1.0.0</Badge>
          </div>
        }
      >
        <Container size="xl">
          <Stack direction="vertical" spacing="xl">
            <PageHeader
              title="UI Component Showcase"
              description="Interactive demonstration of all components in the NextJS Stripe Payment Template"
            />

            {/* Tab Navigation */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                  {tabs.map(tab => (
                    <Button
                      key={tab.id}
                      variant={selectedTab === tab.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTab(tab.id)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tab Content */}
            {renderTabContent()}

            {/* Footer Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2 text-center">
                  <p className="text-muted-foreground text-sm">
                    NextJS Stripe Payment Template - Built with Shadcn UI
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Optimized for Canadian SaaS and E-commerce businesses
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      🇨🇦 Canadian Tax Compliant
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      ♿ WCAG 2.1 AA
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      📱 Mobile First
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      🔒 Stripe Secure
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Stack>
        </Container>
      </ResponsiveLayout>
    </ErrorBoundary>
  );
}
