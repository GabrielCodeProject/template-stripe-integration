'use client';

import { ShoppingCart, Eye, Star, Download } from 'lucide-react';
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
import { formatCAD, truncate } from '@/lib/utils';

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  isDigital?: boolean;
  isOnSale?: boolean;
  isNew?: boolean;
  onAddToCart?: (productId: string) => void;
  onViewDetails?: (productId: string) => void;
  onQuickPreview?: (productId: string) => void;
  className?: string;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(
  (
    {
      id,
      name,
      description,
      price,
      originalPrice,
      image,
      category,
      rating,
      reviewCount,
      isDigital = false,
      isOnSale = false,
      isNew = false,
      onAddToCart,
      onViewDetails,
      onQuickPreview,
      className,
      ...props
    },
    ref
  ) => {
    const [isLoading, setIsLoading] = React.useState(false);
    const [imageError, setImageError] = React.useState(false);

    const handleAddToCart = async () => {
      if (!onAddToCart) {
        return;
      }

      setIsLoading(true);
      try {
        await onAddToCart(id);
      } finally {
        setIsLoading(false);
      }
    };

    const discountPercentage = originalPrice
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

    return (
      <Card
        ref={ref}
        className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${className}`}
        {...props}
      >
        {/* Badges */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {isNew && (
            <Badge variant="success" className="text-xs">
              New
            </Badge>
          )}
          {isOnSale && discountPercentage > 0 && (
            <Badge variant="destructive" className="text-xs">
              -{discountPercentage}%
            </Badge>
          )}
          {isDigital && (
            <Badge variant="outline" className="text-xs">
              Digital
            </Badge>
          )}
        </div>

        {/* Quick Actions */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onQuickPreview && (
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={() => onQuickPreview(id)}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">Quick preview</span>
            </Button>
          )}
        </div>

        <CardHeader className="p-0">
          <div className="relative aspect-square overflow-hidden">
            {!imageError ? (
              <Image
                src={image}
                alt={name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="bg-muted flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="text-muted-foreground mx-auto mb-2 h-12 w-12">
                    {isDigital ? <Download /> : <ShoppingCart />}
                  </div>
                  <p className="text-muted-foreground text-sm">No image</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <Badge variant="outline" className="text-xs">
                {category}
              </Badge>

              {rating && reviewCount && (
                <div className="flex items-center space-x-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-muted-foreground text-xs">
                    {rating} ({reviewCount})
                  </span>
                </div>
              )}
            </div>

            <CardTitle className="text-lg leading-tight">
              {truncate(name, 50)}
            </CardTitle>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {truncate(description, 80)}
            </p>

            <div className="flex items-baseline space-x-2">
              <span className="currency-cad text-xl font-bold">
                {formatCAD(price)}
              </span>
              {originalPrice && originalPrice > price && (
                <span className="text-muted-foreground text-sm line-through">
                  {formatCAD(originalPrice)}
                </span>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2 p-4 pt-0">
          <Button
            className="flex-1"
            onClick={handleAddToCart}
            loading={isLoading}
            disabled={isLoading}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>

          {onViewDetails && (
            <Button variant="outline" onClick={() => onViewDetails(id)}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }
);

ProductCard.displayName = 'ProductCard';

export { ProductCard, type ProductCardProps };
