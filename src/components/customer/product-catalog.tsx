"use client";

import * as React from "react";
import { ProductCard, type ProductCardProps } from "./product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner, Skeleton } from "@/components/ui/loading-spinner";
import { Search, Filter, SortAsc, SortDesc, Grid3X3, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product extends Omit<ProductCardProps, 'onAddToCart' | 'onViewDetails' | 'onQuickPreview'> {
  tags?: string[];
  createdAt?: string;
  popularity?: number;
}

interface ProductCatalogProps {
  products: Product[];
  isLoading?: boolean;
  searchQuery?: string;
  selectedCategory?: string;
  sortBy?: 'name' | 'price' | 'rating' | 'newest' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  viewMode?: 'grid' | 'list';
  categories?: string[];
  onSearchChange?: (query: string) => void;
  onCategoryChange?: (category: string | null) => void;
  onSortChange?: (sortBy: string, order: 'asc' | 'desc') => void;
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onAddToCart?: (productId: string) => void;
  onViewDetails?: (productId: string) => void;
  onQuickPreview?: (productId: string) => void;
  className?: string;
}

const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  isLoading = false,
  searchQuery = "",
  selectedCategory = "",
  sortBy = "name",
  sortOrder = "asc",
  viewMode = "grid",
  categories = [],
  onSearchChange,
  onCategoryChange,
  onSortChange,
  onViewModeChange,
  onAddToCart,
  onViewDetails,
  onQuickPreview,
  className,
}) => {
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(localSearchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery, onSearchChange]);

  const handleSortToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    if (onSortChange) {
      onSortChange(sortBy, newOrder);
    }
  };

  const renderSkeleton = () => (
    <div className={viewMode === 'grid' ? 'grid-responsive' : 'space-y-4'}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Search and filters skeleton */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <Skeleton className="h-10 w-64" />
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        {renderSkeleton()}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search and Filters */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-1 items-center space-x-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === "" ? "default" : "outline"}
                size="sm"
                onClick={() => onCategoryChange?.(null)}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => onCategoryChange?.(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Sort */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSortToggle}
            className="gap-2"
          >
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            Sort
          </Button>

          {/* View Mode */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange?.('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange?.('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length !== 1 ? 's' : ''} found
        </p>
        
        {selectedCategory && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Filtered by:</span>
            <Badge variant="secondary" className="gap-1">
              {selectedCategory}
              <button
                onClick={() => onCategoryChange?.(null)}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                ×
              </button>
            </Badge>
          </div>
        )}
      </div>

      {/* Products Grid/List */}
      {products.length > 0 ? (
        <div className={viewMode === 'grid' ? 'grid-responsive' : 'space-y-4'}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              onAddToCart={onAddToCart}
              onViewDetails={onViewDetails}
              onQuickPreview={onQuickPreview}
              className={viewMode === 'list' ? 'flex flex-row max-w-none' : ''}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground">
            <Search className="h-full w-full" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No products found</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Try adjusting your search or filter criteria to find what you're looking for.
          </p>
          {(selectedCategory || localSearchQuery) && (
            <Button
              variant="outline"
              onClick={() => {
                setLocalSearchQuery("");
                onCategoryChange?.(null);
                onSearchChange?.("");
              }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export { ProductCatalog, type Product };