"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner, Skeleton } from "@/components/ui/loading-spinner";
import { formatCAD, getInitials } from "@/lib/utils";
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  CreditCard, 
  ShoppingBag,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: string;
  totalSpent: number;
  orderCount: number;
  status: 'active' | 'suspended' | 'inactive';
  subscription?: {
    id: string;
    status: 'active' | 'past_due' | 'canceled' | 'unpaid';
    plan: string;
    amount: number;
  };
  paymentMethods: Array<{
    id: string;
    type: string;
    last4: string;
    brand: string;
    isDefault: boolean;
  }>;
  recentOrders: Array<{
    id: string;
    amount: number;
    status: string;
    date: string;
    items: string[];
  }>;
}

interface CustomerLookupProps {
  onCustomerSelect?: (customer: Customer) => void;
  onCreateTicket?: (customerId: string) => void;
  onViewOrders?: (customerId: string) => void;
  onRefund?: (orderId: string) => void;
  className?: string;
}

const CustomerCard: React.FC<{
  customer: Customer;
  onSelect?: () => void;
  onCreateTicket?: () => void;
  onViewOrders?: () => void;
  onRefund?: (orderId: string) => void;
}> = ({ customer, onSelect, onCreateTicket, onViewOrders, onRefund }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'suspended':
        return <Badge variant="warning">Suspended</Badge>;
      case 'inactive':
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubscriptionBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="active" className="text-xs">Active</Badge>;
      case 'past_due':
        return <Badge variant="past_due" className="text-xs">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="cancelled" className="text-xs">Canceled</Badge>;
      case 'unpaid':
        return <Badge variant="unpaid" className="text-xs">Unpaid</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <Card className="card-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <span className="text-sm font-medium">
                {getInitials(customer.name)}
              </span>
            </div>
            
            <div>
              <h3 className="font-semibold">{customer.name}</h3>
              <p className="text-sm text-muted-foreground">{customer.email}</p>
              {customer.phone && (
                <p className="text-xs text-muted-foreground">{customer.phone}</p>
              )}
            </div>
          </div>
          
          {getStatusBadge(customer.status)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Customer Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm font-medium currency-cad">
              {formatCAD(customer.totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </div>
          <div>
            <p className="text-sm font-medium">{customer.orderCount}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div>
            <p className="text-sm font-medium">
              {new Date(customer.createdAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-muted-foreground">Member Since</p>
          </div>
        </div>

        {/* Subscription Info */}
        {customer.subscription && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Subscription</span>
              {getSubscriptionBadge(customer.subscription.status)}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{customer.subscription.plan}</span>
              <span className="currency-cad font-medium">
                {formatCAD(customer.subscription.amount)}/month
              </span>
            </div>
          </div>
        )}

        {/* Payment Methods */}
        {customer.paymentMethods.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Payment Methods</h4>
            <div className="space-y-2">
              {customer.paymentMethods.slice(0, 2).map((method, index) => (
                <div key={method.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                    <span>{method.brand} •••• {method.last4}</span>
                    {method.isDefault && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                </div>
              ))}
              {customer.paymentMethods.length > 2 && (
                <p className="text-xs text-muted-foreground">
                  +{customer.paymentMethods.length - 2} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Recent Orders */}
        {customer.recentOrders.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Orders</h4>
            <div className="space-y-2">
              {customer.recentOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    <span className="currency-cad">{formatCAD(order.amount)}</span>
                    <Badge 
                      variant={
                        order.status === 'completed' ? 'success' :
                        order.status === 'pending' ? 'warning' :
                        order.status === 'refunded' ? 'outline' : 'destructive'
                      }
                      className="text-xs"
                    >
                      {order.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.date).toLocaleDateString()}
                    </span>
                    {(order.status === 'completed' || order.status === 'pending') && onRefund && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRefund(order.id)}
                      >
                        <DollarSign className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          {onSelect && (
            <Button variant="outline" size="sm" onClick={onSelect} className="flex-1">
              <User className="mr-2 h-3 w-3" />
              View Details
            </Button>
          )}
          
          {onCreateTicket && (
            <Button variant="outline" size="sm" onClick={onCreateTicket} className="flex-1">
              <Mail className="mr-2 h-3 w-3" />
              Create Ticket
            </Button>
          )}
          
          {onViewOrders && (
            <Button variant="outline" size="sm" onClick={onViewOrders} className="flex-1">
              <ShoppingBag className="mr-2 h-3 w-3" />
              Orders
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const CustomerLookup: React.FC<CustomerLookupProps> = ({
  onCustomerSelect,
  onCreateTicket,
  onViewOrders,
  onRefund,
  className,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Customer[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  // Mock search function - replace with actual API call
  const searchCustomers = React.useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock data - replace with actual API call
      const mockResults: Customer[] = [
        {
          id: "1",
          email: "john.doe@example.com",
          name: "John Doe",
          phone: "(555) 123-4567",
          createdAt: "2023-01-15",
          totalSpent: 299.97,
          orderCount: 3,
          status: "active",
          subscription: {
            id: "sub_1",
            status: "active",
            plan: "Pro Plan",
            amount: 29.99
          },
          paymentMethods: [
            {
              id: "pm_1",
              type: "card",
              last4: "4242",
              brand: "Visa",
              isDefault: true
            }
          ],
          recentOrders: [
            {
              id: "ord_1",
              amount: 99.99,
              status: "completed",
              date: "2024-01-20",
              items: ["Pro Subscription"]
            },
            {
              id: "ord_2",
              amount: 199.98,
              status: "completed",
              date: "2024-01-15",
              items: ["Premium Bundle"]
            }
          ]
        }
      ].filter(customer => 
        customer.email.toLowerCase().includes(query.toLowerCase()) ||
        customer.name.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults(mockResults);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchCustomers]);

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <CardTitle>Customer Lookup</CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, or customer ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" text="Searching customers..." />
        </div>
      )}

      {!isSearching && hasSearched && (
        <div className="space-y-4">
          {searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Found {searchResults.length} customer{searchResults.length !== 1 ? 's' : ''}
              </p>
              
              <div className="grid gap-4">
                {searchResults.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onSelect={() => onCustomerSelect?.(customer)}
                    onCreateTicket={() => onCreateTicket?.(customer.id)}
                    onViewOrders={() => onViewOrders?.(customer.id)}
                    onRefund={onRefund}
                  />
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground">
                  <Search className="h-full w-full" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No customers found</h3>
                <p className="text-muted-foreground max-w-md">
                  No customers match your search criteria. Try searching with a different email, name, or customer ID.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!hasSearched && !isSearching && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground">
              <User className="h-full w-full" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Search for customers</h3>
            <p className="text-muted-foreground max-w-md">
              Enter a customer's email, name, or ID to view their details, orders, and subscription information.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { CustomerLookup, type Customer };