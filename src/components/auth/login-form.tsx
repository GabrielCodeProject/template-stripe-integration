'use client';

import { Eye, EyeOff, Lock, Mail, Shield, AlertTriangle } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isValidEmail, cn } from '@/lib/utils';

interface LoginFormProps {
  onSubmit?: (credentials: LoginCredentials) => Promise<void>;
  onForgotPassword?: (email: string) => void;
  onSignUp?: () => void;
  defaultEmail?: string;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  onForgotPassword,
  onSignUp,
  defaultEmail = '',
  isLoading = false,
  error,
  className,
}) => {
  const [formData, setFormData] = React.useState<LoginCredentials>({
    email: defaultEmail,
    password: '',
    rememberMe: false,
  });

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !onSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (
    field: keyof LoginCredentials,
    value: string | boolean
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Card className={cn('mx-auto w-full max-w-md', className)}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Global Error */}
          {error && (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm leading-none font-medium">
              Email Address <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={e => updateFormData('email', e.target.value)}
                error={fieldErrors.email}
                className="pl-10"
                disabled={isLoading || isSubmitting}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-sm leading-none font-medium">
              Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={e => updateFormData('password', e.target.value)}
                error={fieldErrors.password}
                className="pr-10 pl-10"
                disabled={isLoading || isSubmitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading || isSubmitting}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember-me"
                checked={formData.rememberMe}
                onChange={e => updateFormData('rememberMe', e.target.checked)}
                className="border-input rounded"
                disabled={isLoading || isSubmitting}
              />
              <label
                htmlFor="remember-me"
                className="text-muted-foreground text-sm"
              >
                Remember me
              </label>
            </div>

            {onForgotPassword && (
              <button
                type="button"
                onClick={() => onForgotPassword(formData.email)}
                className="text-primary text-sm hover:underline"
                disabled={isLoading || isSubmitting}
              >
                Forgot password?
              </button>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading || isSubmitting}
            loading={isSubmitting}
          >
            <Shield className="mr-2 h-4 w-4" />
            Sign In
          </Button>

          {/* Sign Up Link */}
          {onSignUp && (
            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-primary font-medium hover:underline"
                  disabled={isLoading || isSubmitting}
                >
                  Sign up
                </button>
              </p>
            </div>
          )}
        </form>

        {/* Security Notice */}
        <div className="text-muted-foreground mt-6 flex items-center justify-center gap-2 text-xs">
          <Shield className="h-3 w-3" />
          <span>Your connection is secure and encrypted</span>
        </div>
      </CardContent>
    </Card>
  );
};

export { LoginForm, type LoginCredentials };
