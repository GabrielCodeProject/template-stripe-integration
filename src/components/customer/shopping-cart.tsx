'use client';

import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCAD, cn } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  quantity: number;
  isDigital?: boolean;
  maxQuantity?: number;
}

interface ShoppingCartProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  province?: string;
  isLoading?: boolean;
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
  onRemoveItem?: (itemId: string) => void;
  onCheckout?: () => void;
  onContinueShopping?: () => void;
  className?: string;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({
  items,
  subtotal,
  tax,
  total,
  province = 'ON',
  isLoading = false,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onContinueShopping,
  className,
}) => {
  const [updatingItems, setUpdatingItems] = React.useState<Set<string>>(
    new Set()
  );

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (!onUpdateQuantity || newQuantity < 0) {
      return;
    }

    setUpdatingItems(prev => new Set(prev).add(itemId));
    try {
      await onUpdateQuantity(itemId, newQuantity);
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!onRemoveItem) {
      return;
    }

    setUpdatingItems(prev => new Set(prev).add(itemId));
    try {
      await onRemoveItem(itemId);
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  if (items.length === 0) {
    return (
      <Card className={cn('mx-auto w-full max-w-2xl', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-muted-foreground mx-auto mb-4 h-12 w-12">
            <ShoppingBag className="h-full w-full" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Your cart is empty</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Looks like you haven't added any items to your cart yet. Start
            shopping to fill it up!
          </p>
          {onContinueShopping && (
            <Button onClick={onContinueShopping}>Continue Shopping</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shopping Cart ({items.length} item{items.length !== 1 ? 's' : ''})
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {items.map(item => {
            const isUpdating = updatingItems.has(item.id);
            const itemTotal = item.price * item.quantity;
            const savings = item.originalPrice
              ? (item.originalPrice - item.price) * item.quantity
              : 0;

            return (
              <div
                key={item.id}
                className={cn(
                  'flex gap-4 rounded-lg border p-4 transition-opacity',
                  isUpdating && 'opacity-50'
                )}
              >
                {/* Product Image */}
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Product Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-medium">{item.name}</h4>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                        {item.isDigital && (
                          <Badge variant="secondary" className="text-xs">
                            Digital
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isUpdating}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove item</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleQuantityChange(item.id, item.quantity - 1)
                        }
                        disabled={isUpdating || item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>

                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleQuantityChange(item.id, item.quantity + 1)
                        }
                        disabled={
                          isUpdating ||
                          (item.maxQuantity &&
                            item.quantity >= item.maxQuantity)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <div className="currency-cad font-semibold">
                        {formatCAD(itemTotal)}
                      </div>
                      {item.originalPrice && (
                        <div className="text-muted-foreground text-xs">
                          <span className="line-through">
                            {formatCAD(item.originalPrice * item.quantity)}
                          </span>
                          <span className="text-success ml-1">
                            Save {formatCAD(savings)}
                          </span>
                        </div>
                      )}
                      <div className="text-muted-foreground text-xs">
                        {formatCAD(item.price)} each
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Summary</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="currency-cad">{formatCAD(subtotal)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({province})</span>
            <span className="currency-cad">{formatCAD(tax)}</span>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="currency-cad text-lg">{formatCAD(total)}</span>
            </div>
          </div>

          {/* Canadian Tax Notice */}
          <p className="text-muted-foreground text-xs">
            * Tax calculated based on {province} rates. Final tax may vary based
            on billing address.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full"
            size="lg"
            onClick={onCheckout}
            disabled={isLoading || items.length === 0}
            loading={isLoading}
          >
            Proceed to Checkout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {onContinueShopping && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onContinueShopping}
            >
              Continue Shopping
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export { ShoppingCart, type CartItem };
