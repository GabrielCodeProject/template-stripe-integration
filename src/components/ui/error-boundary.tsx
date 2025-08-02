"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, Bug, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'component' | 'section';
  className?: string;
}

interface ErrorFallbackProps {
  error?: Error;
  resetError: () => void;
  level?: 'page' | 'component' | 'section';
}

interface NotFoundProps {
  title?: string;
  description?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  onHome?: () => void;
  onBack?: () => void;
  className?: string;
}

interface ApiErrorProps {
  error: {
    status?: number;
    message?: string;
    code?: string;
  };
  onRetry?: () => void;
  showSupport?: boolean;
  className?: string;
}

// Default error fallback component
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  level = 'component'
}) => {
  const isPageLevel = level === 'page';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className={cn(
      "flex items-center justify-center",
      isPageLevel ? "min-h-[400px] p-4" : "p-6"
    )}>
      <Card className={cn("w-full", isPageLevel ? "max-w-lg" : "max-w-md")}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-destructive">
            <AlertTriangle className="h-full w-full" />
          </div>
          <CardTitle className={isPageLevel ? "text-xl" : "text-lg"}>
            {isPageLevel ? "Something went wrong" : "Error occurred"}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {isPageLevel 
              ? "We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists."
              : "An error occurred while loading this content."
            }
          </p>

          {isDevelopment && error && (
            <details className="text-left text-xs bg-muted p-3 rounded-lg">
              <summary className="cursor-pointer font-medium text-destructive mb-2">
                Error Details (Development)
              </summary>
              <pre className="whitespace-pre-wrap overflow-auto">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={resetError} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            
            {isPageLevel && (
              <Button variant="outline" onClick={() => window.location.href = '/'} className="gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Error Boundary Class Component
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <div className={this.props.className}>
          <FallbackComponent
            error={this.state.error}
            resetError={this.resetError}
            level={this.props.level}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for error handling
const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    console.error('Error caught by useErrorHandler:', error);
    setError(error);
  }, []);

  // Throw error to nearest error boundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
};

// 404 Not Found component
const NotFound: React.FC<NotFoundProps> = ({
  title = "Page Not Found",
  description = "Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or you entered the wrong URL.",
  showHomeButton = true,
  showBackButton = true,
  onHome,
  onBack,
  className,
}) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const handleHome = () => {
    if (onHome) {
      onHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className={cn("flex items-center justify-center min-h-[400px] p-4", className)}>
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 text-6xl font-bold text-muted-foreground">
            404
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{description}</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {showBackButton && (
              <Button variant="outline" onClick={handleBack}>
                Go Back
              </Button>
            )}
            
            {showHomeButton && (
              <Button onClick={handleHome} className="gap-2">
                <Home className="h-4 w-4" />
                Home Page
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// API Error component
const ApiError: React.FC<ApiErrorProps> = ({
  error,
  onRetry,
  showSupport = true,
  className,
}) => {
  const getErrorMessage = () => {
    if (error.status === 404) {
      return "The requested resource was not found.";
    } else if (error.status === 403) {
      return "You don't have permission to access this resource.";
    } else if (error.status === 401) {
      return "Please sign in to access this resource.";
    } else if (error.status && error.status >= 500) {
      return "Server error occurred. Please try again later.";
    } else if (error.message) {
      return error.message;
    } else {
      return "An unexpected error occurred.";
    }
  };

  const getErrorTitle = () => {
    if (error.status === 404) return "Not Found";
    if (error.status === 403) return "Access Denied";
    if (error.status === 401) return "Authentication Required";
    if (error.status && error.status >= 500) return "Server Error";
    return "Error";
  };

  return (
    <div className={cn("flex items-center justify-center p-6", className)}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-destructive">
            <AlertTriangle className="h-full w-full" />
          </div>
          <CardTitle className="text-lg">{getErrorTitle()}</CardTitle>
          {error.status && (
            <p className="text-sm text-muted-foreground">Error {error.status}</p>
          )}
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{getErrorMessage()}</p>

          <div className="flex flex-col gap-2">
            {onRetry && (
              <Button onClick={onRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            
            {showSupport && (
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Network Error component
const NetworkError: React.FC<{
  onRetry?: () => void;
  className?: string;
}> = ({ onRetry, className }) => {
  return (
    <ApiError
      error={{
        status: 0,
        message: "Network connection failed. Please check your internet connection and try again.",
      }}
      onRetry={onRetry}
      className={className}
    />
  );
};

export {
  ErrorBoundary,
  DefaultErrorFallback,
  NotFound,
  ApiError,
  NetworkError,
  useErrorHandler,
  type ErrorBoundaryProps,
  type ErrorFallbackProps,
  type NotFoundProps,
  type ApiErrorProps,
};