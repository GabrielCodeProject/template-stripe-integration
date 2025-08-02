'use client';

import {
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Activity,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCAD, cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    period: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon: React.ReactNode;
  description?: string;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  description,
  className,
}) => {
  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn('card-shadow', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        <div className="text-muted-foreground h-4 w-4">{icon}</div>
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === 'number' && title.toLowerCase().includes('revenue')
            ? formatCAD(value)
            : value}
        </div>

        {change && (
          <div
            className={cn(
              'mt-1 flex items-center text-xs',
              getTrendColor(change.trend)
            )}
          >
            {getTrendIcon(change.trend)}
            <span className="ml-1">
              {change.trend === 'up' ? '+' : change.trend === 'down' ? '-' : ''}
              {Math.abs(change.value)}% from {change.period}
            </span>
          </div>
        )}

        {description && (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

interface RecentSaleProps {
  customer: {
    name: string;
    email: string;
    avatar?: string;
  };
  amount: number;
  product: string;
  date: string;
}

const RecentSale: React.FC<RecentSaleProps> = ({
  customer,
  amount,
  product,
  date,
}) => (
  <div className="flex items-center space-x-4">
    <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
      <span className="text-sm font-medium">
        {customer.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()}
      </span>
    </div>

    <div className="flex-1 space-y-1">
      <p className="text-sm leading-none font-medium">{customer.name}</p>
      <p className="text-muted-foreground text-xs">{customer.email}</p>
      <p className="text-muted-foreground text-xs">{product}</p>
    </div>

    <div className="text-right">
      <p className="currency-cad text-sm font-medium">{formatCAD(amount)}</p>
      <p className="text-muted-foreground text-xs">{date}</p>
    </div>
  </div>
);

interface DashboardData {
  metrics: {
    totalRevenue: number;
    monthlyRevenue: number;
    totalCustomers: number;
    activeSubscriptions: number;
    averageOrderValue: number;
    conversionRate: number;
  };
  changes: {
    revenue: { value: number; trend: 'up' | 'down' | 'neutral' };
    customers: { value: number; trend: 'up' | 'down' | 'neutral' };
    subscriptions: { value: number; trend: 'up' | 'down' | 'neutral' };
    aov: { value: number; trend: 'up' | 'down' | 'neutral' };
  };
  recentSales: RecentSaleProps[];
  topProducts: Array<{
    name: string;
    sales: number;
    revenue: number;
    change: number;
  }>;
}

interface DashboardOverviewProps {
  data: DashboardData;
  isLoading?: boolean;
  className?: string;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  data,
  isLoading = false,
  className,
}) => {
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="grid-dashboard">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="bg-muted h-4 w-3/4 rounded" />
              </CardHeader>
              <CardContent>
                <div className="bg-muted mb-2 h-8 w-1/2 rounded" />
                <div className="bg-muted h-3 w-1/3 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Key Metrics */}
      <div className="grid-dashboard">
        <MetricCard
          title="Total Revenue"
          value={data.metrics.totalRevenue}
          change={{
            value: data.changes.revenue.value,
            period: 'last month',
            trend: data.changes.revenue.trend,
          }}
          icon={<DollarSign className="h-4 w-4" />}
          description="All-time revenue"
        />

        <MetricCard
          title="Monthly Revenue"
          value={data.metrics.monthlyRevenue}
          change={{
            value: data.changes.revenue.value,
            period: 'last month',
            trend: data.changes.revenue.trend,
          }}
          icon={<Calendar className="h-4 w-4" />}
          description="This month's revenue"
        />

        <MetricCard
          title="Total Customers"
          value={data.metrics.totalCustomers.toLocaleString()}
          change={{
            value: data.changes.customers.value,
            period: 'last month',
            trend: data.changes.customers.trend,
          }}
          icon={<Users className="h-4 w-4" />}
          description="Registered customers"
        />

        <MetricCard
          title="Active Subscriptions"
          value={data.metrics.activeSubscriptions.toLocaleString()}
          change={{
            value: data.changes.subscriptions.value,
            period: 'last month',
            trend: data.changes.subscriptions.trend,
          }}
          icon={<Activity className="h-4 w-4" />}
          description="Currently active"
        />

        <MetricCard
          title="Average Order Value"
          value={data.metrics.averageOrderValue}
          change={{
            value: data.changes.aov.value,
            period: 'last month',
            trend: data.changes.aov.trend,
          }}
          icon={<ShoppingCart className="h-4 w-4" />}
          description="Per transaction"
        />

        <MetricCard
          title="Conversion Rate"
          value={`${data.metrics.conversionRate}%`}
          icon={<Target className="h-4 w-4" />}
          description="Visitor to customer"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {data.recentSales.length > 0 ? (
              data.recentSales.map((sale, index) => (
                <RecentSale key={index} {...sale} />
              ))
            ) : (
              <div className="text-muted-foreground py-6 text-center">
                <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No recent sales</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {data.topProducts.length > 0 ? (
              data.topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {product.sales} sales
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <span className="currency-cad text-sm font-medium">
                      {formatCAD(product.revenue)}
                    </span>

                    <Badge
                      variant={product.change >= 0 ? 'success' : 'destructive'}
                      className="text-xs"
                    >
                      {product.change >= 0 ? '+' : ''}
                      {product.change}%
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground py-6 text-center">
                <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No product data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export {
  DashboardOverview,
  MetricCard,
  type DashboardData,
  type MetricCardProps,
};
