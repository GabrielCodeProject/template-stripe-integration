"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Lock, Home } from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = 'admin' | 'customer' | 'support';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
}

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  user?: User | null;
  isLoading?: boolean;
  fallback?: React.ReactNode;
  onLogin?: () => void;
  onGoHome?: () => void;
  className?: string;
}

const AccessDenied: React.FC<{
  userRole?: UserRole;
  allowedRoles: UserRole[];
  onLogin?: () => void;
  onGoHome?: () => void;
}> = ({ userRole, allowedRoles, onLogin, onGoHome }) => {
  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrator',
    customer: 'Customer',
    support: 'Support Agent',
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground">
            <Lock className="h-full w-full" />
          </div>
          <CardTitle className="text-xl">Access Restricted</CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <div className="text-sm text-muted-foreground">
            {userRole ? (
              <>
                <p className="mb-2">
                  Your current role: <span className="font-medium">{roleLabels[userRole]}</span>
                </p>
                <p>
                  This page requires one of the following roles:
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {allowedRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted"
                    >
                      {roleLabels[role]}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p>You need to be signed in to access this page.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {!userRole && onLogin && (
              <Button onClick={onLogin} className="w-full">
                <Shield className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            )}
            
            {onGoHome && (
              <Button 
                variant={userRole ? "default" : "outline"} 
                onClick={onGoHome}
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Homepage
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center space-y-4">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">Checking permissions...</p>
    </div>
  </div>
);

const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  user,
  isLoading = false,
  fallback,
  onLogin,
  onGoHome,
  className,
}) => {
  // Show loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // User not authenticated
  if (!user) {
    return fallback || (
      <AccessDenied
        allowedRoles={allowedRoles}
        onLogin={onLogin}
        onGoHome={onGoHome}
      />
    );
  }

  // User doesn't have required role
  if (!allowedRoles.includes(user.role)) {
    return fallback || (
      <AccessDenied
        userRole={user.role}
        allowedRoles={allowedRoles}
        onLogin={onLogin}
        onGoHome={onGoHome}
      />
    );
  }

  // User has access
  return <div className={className}>{children}</div>;
};

// Permission-based guard for more granular control
interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions: string[];
  user?: User | null;
  requireAll?: boolean; // If true, user needs ALL permissions. If false, user needs ANY permission
  isLoading?: boolean;
  fallback?: React.ReactNode;
  onLogin?: () => void;
  onGoHome?: () => void;
  className?: string;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermissions,
  user,
  requireAll = true,
  isLoading = false,
  fallback,
  onLogin,
  onGoHome,
  className,
}) => {
  if (isLoading) {
    return <LoadingState />;
  }

  if (!user) {
    return fallback || (
      <AccessDenied
        allowedRoles={['admin', 'customer', 'support']}
        onLogin={onLogin}
        onGoHome={onGoHome}
      />
    );
  }

  const userPermissions = user.permissions || [];
  
  const hasPermission = requireAll
    ? requiredPermissions.every(permission => userPermissions.includes(permission))
    : requiredPermissions.some(permission => userPermissions.includes(permission));

  if (!hasPermission) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground">
              <AlertTriangle className="h-full w-full" />
            </div>
            <CardTitle className="text-xl">Insufficient Permissions</CardTitle>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              You don't have the necessary permissions to access this feature.
            </p>
            
            <div className="text-xs text-muted-foreground">
              <p className="mb-2">Required permissions:</p>
              <div className="flex flex-wrap justify-center gap-1">
                {requiredPermissions.map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex items-center px-2 py-1 rounded-full bg-muted"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>

            {onGoHome && (
              <Button onClick={onGoHome} className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};

// Higher-order component for role-based routing
const withRoleGuard = <P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: UserRole[]
) => {
  const WrappedComponent = (props: P & { user?: User | null; isLoading?: boolean }) => {
    const { user, isLoading, ...componentProps } = props;
    
    return (
      <RoleGuard
        allowedRoles={allowedRoles}
        user={user}
        isLoading={isLoading}
      >
        <Component {...(componentProps as P)} />
      </RoleGuard>
    );
  };

  WrappedComponent.displayName = `withRoleGuard(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

export { 
  RoleGuard, 
  PermissionGuard, 
  withRoleGuard, 
  type User, 
  type UserRole 
};