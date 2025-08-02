'use client';

import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  Download,
  Upload,
  Copy,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner, Skeleton } from '@/components/ui/loading-spinner';
import { formatCAD, truncate, cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  status: 'active' | 'draft' | 'archived';
  isDigital: boolean;
  stock?: number;
  sales: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
  image?: string;
}

interface ProductManagementProps {
  products: Product[];
  isLoading?: boolean;
  searchQuery?: string;
  selectedCategory?: string;
  selectedStatus?: string;
  categories?: string[];
  onSearchChange?: (query: string) => void;
  onCategoryChange?: (category: string | null) => void;
  onStatusChange?: (status: string | null) => void;
  onCreateProduct?: () => void;
  onEditProduct?: (productId: string) => void;
  onDeleteProduct?: (productId: string) => void;
  onViewProduct?: (productId: string) => void;
  onDuplicateProduct?: (productId: string) => void;
  className?: string;
}

const ProductRow: React.FC<{
  product: Product;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}> = ({ product, onEdit, onDelete, onView, onDuplicate }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleAction = async (action: () => void) => {
    setIsLoading(true);
    try {
      await action();
    } finally {
      setIsLoading(false);
      setIsMenuOpen(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'draft':
        return <Badge variant="warning">Draft</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div
      className={cn(
        'hover:bg-muted/50 flex items-center space-x-4 rounded-lg border p-4 transition-colors',
        isLoading && 'opacity-50'
      )}
    >
      {/* Product Image */}
      <div className="bg-muted h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {product.isDigital ? (
              <Download className="text-muted-foreground h-5 w-5" />
            ) : (
              <Upload className="text-muted-foreground h-5 w-5" />
            )}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center space-x-2">
          <h3 className="truncate font-medium">{product.name}</h3>
          {getStatusBadge(product.status)}
          {product.isDigital && (
            <Badge variant="outline" className="text-xs">
              Digital
            </Badge>
          )}
        </div>

        <p className="text-muted-foreground mb-1 truncate text-sm">
          {truncate(product.description, 100)}
        </p>

        <div className="text-muted-foreground flex items-center space-x-4 text-xs">
          <span>Category: {product.category}</span>
          <span>Sales: {product.sales.toLocaleString()}</span>
          {!product.isDigital && product.stock !== undefined && (
            <span>Stock: {product.stock}</span>
          )}
        </div>
      </div>

      {/* Pricing */}
      <div className="text-right">
        <div className="currency-cad font-semibold">
          {formatCAD(product.price)}
        </div>
        {product.originalPrice && product.originalPrice > product.price && (
          <div className="text-muted-foreground text-xs line-through">
            {formatCAD(product.originalPrice)}
          </div>
        )}
        <div className="text-muted-foreground text-xs">
          Revenue: {formatCAD(product.revenue)}
        </div>
      </div>

      {/* Actions */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </Button>

        {isMenuOpen && (
          <div className="bg-popover absolute top-full right-0 z-10 mt-1 w-40 rounded-md border shadow-lg">
            <div className="py-1">
              {onView && (
                <button
                  className="hover:bg-accent flex w-full items-center px-3 py-2 text-sm"
                  onClick={() => handleAction(() => onView(product.id))}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </button>
              )}

              {onEdit && (
                <button
                  className="hover:bg-accent flex w-full items-center px-3 py-2 text-sm"
                  onClick={() => handleAction(() => onEdit(product.id))}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </button>
              )}

              {onDuplicate && (
                <button
                  className="hover:bg-accent flex w-full items-center px-3 py-2 text-sm"
                  onClick={() => handleAction(() => onDuplicate(product.id))}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </button>
              )}

              <div className="my-1 border-t" />

              {onDelete && (
                <button
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground flex w-full items-center px-3 py-2 text-sm"
                  onClick={() => handleAction(() => onDelete(product.id))}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductManagement: React.FC<ProductManagementProps> = ({
  products,
  isLoading = false,
  searchQuery = '',
  selectedCategory = '',
  selectedStatus = '',
  categories = [],
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onCreateProduct,
  onEditProduct,
  onDeleteProduct,
  onViewProduct,
  onDuplicateProduct,
  className,
}) => {
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(localSearchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery, onSearchChange]);

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
  ];

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center space-x-4 rounded-lg border p-4"
              >
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <div className="space-y-1 text-right">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Management</CardTitle>

            {onCreateProduct && (
              <Button onClick={onCreateProduct} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search products..."
                value={localSearchQuery}
                onChange={e => setLocalSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex space-x-2">
              {/* Category Filter */}
              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={e => onCategoryChange?.(e.target.value || null)}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              )}

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={e => onStatusChange?.(e.target.value || null)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {products.length} product{products.length !== 1 ? 's' : ''} found
            </p>

            {(selectedCategory || selectedStatus || localSearchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocalSearchQuery('');
                  onSearchChange?.('');
                  onCategoryChange?.(null);
                  onStatusChange?.(null);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Products List */}
          <div className="space-y-3">
            {products.length > 0 ? (
              products.map(product => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onEdit={onEditProduct}
                  onDelete={onDeleteProduct}
                  onView={onViewProduct}
                  onDuplicate={onDuplicateProduct}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <div className="text-muted-foreground mx-auto mb-4 h-12 w-12">
                  <Search className="h-full w-full" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  No products found
                </h3>
                <p className="text-muted-foreground mb-4">
                  {localSearchQuery || selectedCategory || selectedStatus
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Get started by creating your first product.'}
                </p>
                {onCreateProduct && (
                  <Button onClick={onCreateProduct} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Product
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { ProductManagement, type Product };
