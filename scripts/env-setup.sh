#!/bin/bash

# Environment Setup Script for Stripe Payment Template
# This script helps configure environments for different deployment stages

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT=${1:-development}
FORCE_OVERWRITE=${FORCE_OVERWRITE:-false}

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to generate secure random string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to validate required tools
validate_tools() {
    print_status $BLUE "Validating required tools..."
    
    local tools=("openssl" "docker" "docker-compose")
    local missing_tools=()
    
    for tool in "${tools[@]}"; do
        if ! command -v $tool >/dev/null 2>&1; then
            missing_tools+=($tool)
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_status $RED "Missing required tools: ${missing_tools[*]}"
        print_status $YELLOW "Please install the missing tools and run again."
        exit 1
    fi
    
    print_status $GREEN "All required tools are available."
}

# Function to create environment file
create_env_file() {
    local env_file=$1
    local template_file="${PROJECT_ROOT}/.env.example"
    
    if [ ! -f "$template_file" ]; then
        print_status $RED "Template file .env.example not found!"
        exit 1
    fi
    
    if [ -f "$env_file" ] && [ "$FORCE_OVERWRITE" != "true" ]; then
        print_status $YELLOW "Environment file $env_file already exists."
        read -p "Do you want to overwrite it? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status $BLUE "Keeping existing environment file."
            return 0
        fi
    fi
    
    print_status $BLUE "Creating environment file: $env_file"
    
    # Copy template and customize based on environment
    cp "$template_file" "$env_file"
    
    # Generate secure secrets
    local nextauth_secret=$(generate_secret 32)
    local db_password=$(generate_secret 16)
    local redis_password=$(generate_secret 16)
    
    # Replace placeholders based on environment
    case $ENVIRONMENT in
        development)
            configure_development "$env_file" "$nextauth_secret" "$db_password" "$redis_password"
            ;;
        staging)
            configure_staging "$env_file" "$nextauth_secret" "$db_password" "$redis_password"
            ;;
        production)
            configure_production "$env_file" "$nextauth_secret" "$db_password" "$redis_password"
            ;;
        *)
            print_status $RED "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    print_status $GREEN "Environment file created successfully!"
}

# Function to configure development environment
configure_development() {
    local env_file=$1
    local nextauth_secret=$2
    local db_password=$3
    local redis_password=$4
    
    print_status $BLUE "Configuring development environment..."
    
    # Update development-specific values
    sed -i.bak "s|NODE_ENV=development|NODE_ENV=development|g" "$env_file"
    sed -i.bak "s|your-super-secret-key-change-this-in-production|$nextauth_secret|g" "$env_file"
    sed -i.bak "s|your_secure_password|$db_password|g" "$env_file"
    sed -i.bak "s|your_secure_redis_password|$redis_password|g" "$env_file"
    sed -i.bak "s|NEXTAUTH_URL=http://localhost:3000|NEXTAUTH_URL=http://localhost:3000|g" "$env_file"
    sed -i.bak "s|NEXT_PUBLIC_APP_URL=http://localhost:3000|NEXT_PUBLIC_APP_URL=http://localhost:3000|g" "$env_file"
    sed -i.bak "s|SESSION_SECURE=false|SESSION_SECURE=false|g" "$env_file"
    sed -i.bak "s|SENTRY_ENVIRONMENT=development|SENTRY_ENVIRONMENT=development|g" "$env_file"
    
    # Remove backup file
    rm -f "${env_file}.bak"
}

# Function to configure staging environment
configure_staging() {
    local env_file=$1
    local nextauth_secret=$2
    local db_password=$3
    local redis_password=$4
    
    print_status $BLUE "Configuring staging environment..."
    
    # Update staging-specific values
    sed -i.bak "s|NODE_ENV=development|NODE_ENV=staging|g" "$env_file"
    sed -i.bak "s|your-super-secret-key-change-this-in-production|$nextauth_secret|g" "$env_file"
    sed -i.bak "s|your_secure_password|$db_password|g" "$env_file"
    sed -i.bak "s|your_secure_redis_password|$redis_password|g" "$env_file"
    sed -i.bak "s|stripe_template_dev|stripe_template_staging|g" "$env_file"
    sed -i.bak "s|NEXTAUTH_URL=http://localhost:3000|NEXTAUTH_URL=https://staging.yourapp.com|g" "$env_file"
    sed -i.bak "s|NEXT_PUBLIC_APP_URL=http://localhost:3000|NEXT_PUBLIC_APP_URL=https://staging.yourapp.com|g" "$env_file"
    sed -i.bak "s|SESSION_SECURE=false|SESSION_SECURE=true|g" "$env_file"
    sed -i.bak "s|SENTRY_ENVIRONMENT=development|SENTRY_ENVIRONMENT=staging|g" "$env_file"
    sed -i.bak "s|LOG_LEVEL=info|LOG_LEVEL=warn|g" "$env_file"
    
    # Remove backup file
    rm -f "${env_file}.bak"
    
    print_status $YELLOW "Remember to update the following for staging:"
    print_status $YELLOW "- Replace 'yourapp.com' with your actual domain"
    print_status $YELLOW "- Configure Stripe test keys"
    print_status $YELLOW "- Set up proper database and Redis URLs"
}

# Function to configure production environment
configure_production() {
    local env_file=$1
    local nextauth_secret=$2
    local db_password=$3
    local redis_password=$4
    
    print_status $BLUE "Configuring production environment..."
    
    # Update production-specific values
    sed -i.bak "s|NODE_ENV=development|NODE_ENV=production|g" "$env_file"
    sed -i.bak "s|your-super-secret-key-change-this-in-production|$nextauth_secret|g" "$env_file"
    sed -i.bak "s|your_secure_password|$db_password|g" "$env_file"
    sed -i.bak "s|your_secure_redis_password|$redis_password|g" "$env_file"
    sed -i.bak "s|stripe_template_dev|stripe_template_prod|g" "$env_file"
    sed -i.bak "s|NEXTAUTH_URL=http://localhost:3000|NEXTAUTH_URL=https://yourapp.com|g" "$env_file"
    sed -i.bak "s|NEXT_PUBLIC_APP_URL=http://localhost:3000|NEXT_PUBLIC_APP_URL=https://yourapp.com|g" "$env_file"
    sed -i.bak "s|SESSION_SECURE=false|SESSION_SECURE=true|g" "$env_file"
    sed -i.bak "s|SENTRY_ENVIRONMENT=development|SENTRY_ENVIRONMENT=production|g" "$env_file"
    sed -i.bak "s|LOG_LEVEL=info|LOG_LEVEL=warn|g" "$env_file"
    sed -i.bak "s|DEBUG=false|DEBUG=false|g" "$env_file"
    sed -i.bak "s|SKIP_EMAIL_SENDING=true|SKIP_EMAIL_SENDING=false|g" "$env_file"
    
    # Remove backup file
    rm -f "${env_file}.bak"
    
    print_status $RED "IMPORTANT: Production environment requires manual configuration!"
    print_status $YELLOW "Please update the following before deployment:"
    print_status $YELLOW "- Replace 'yourapp.com' with your actual domain"
    print_status $YELLOW "- Configure Stripe LIVE keys (pk_live_... and sk_live_...)"
    print_status $YELLOW "- Set up production database and Redis URLs"
    print_status $YELLOW "- Configure SMTP settings for email delivery"
    print_status $YELLOW "- Set up monitoring (Sentry DSN, etc.)"
    print_status $YELLOW "- Configure SSL certificates"
}

# Function to create database initialization script
create_db_init() {
    local init_dir="${PROJECT_ROOT}/database/init"
    mkdir -p "$init_dir"
    
    local init_file="${init_dir}/01-init.sql"
    
    print_status $BLUE "Creating database initialization script..."
    
    cat > "$init_file" << 'EOF'
-- Database initialization script for Stripe Payment Template
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional databases if needed
-- CREATE DATABASE stripe_template_test;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create read-only user for monitoring
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'monitoring') THEN
        CREATE ROLE monitoring WITH LOGIN PASSWORD 'monitoring_password';
        GRANT CONNECT ON DATABASE current_database() TO monitoring;
        GRANT USAGE ON SCHEMA public TO monitoring;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO monitoring;
    END IF;
END
$$;

-- Configure PostgreSQL for better performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';

-- Reload configuration
SELECT pg_reload_conf();
EOF
    
    print_status $GREEN "Database initialization script created."
}

# Function to create secrets management file
create_secrets_template() {
    local secrets_file="${PROJECT_ROOT}/secrets.example"
    
    print_status $BLUE "Creating secrets template..."
    
    cat > "$secrets_file" << 'EOF'
# Secrets Management Template
# This file contains all the secrets that need to be configured for each environment
# Never commit actual secrets to version control!

# Generated Secrets (automatically created by env-setup.sh)
NEXTAUTH_SECRET=generated_automatically
DATABASE_PASSWORD=generated_automatically
REDIS_PASSWORD=generated_automatically

# Stripe Secrets (must be configured manually)
STRIPE_PUBLISHABLE_KEY=pk_test_or_live_key_here
STRIPE_SECRET_KEY=sk_test_or_live_key_here
STRIPE_WEBHOOK_SECRET=whsec_webhook_secret_here

# Third-party Service Keys
SMTP_PASS=your_email_app_password
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Cloud Provider Keys (if using cloud storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Monitoring Passwords
GRAFANA_ADMIN_PASSWORD=secure_grafana_password

# SSL Certificate Paths (for production)
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
SSL_CHAIN_PATH=/etc/nginx/ssl/chain.pem
EOF
    
    print_status $GREEN "Secrets template created at: $secrets_file"
}

# Function to validate environment file
validate_env_file() {
    local env_file=$1
    
    print_status $BLUE "Validating environment file..."
    
    local required_vars=(
        "NODE_ENV"
        "DATABASE_URL"
        "NEXTAUTH_SECRET"
        "STRIPE_PUBLISHABLE_KEY"
        "STRIPE_SECRET_KEY"
        "NEXT_PUBLIC_APP_URL"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file" || grep -q "^${var}=.*your_.*" "$env_file"; then
            missing_vars+=($var)
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_status $YELLOW "Warning: The following variables need manual configuration:"
        for var in "${missing_vars[@]}"; do
            print_status $YELLOW "  - $var"
        done
    else
        print_status $GREEN "Environment file validation passed."
    fi
}

# Function to create environment-specific directories
create_directories() {
    print_status $BLUE "Creating necessary directories..."
    
    local dirs=(
        "${PROJECT_ROOT}/uploads"
        "${PROJECT_ROOT}/logs"
        "${PROJECT_ROOT}/backups"
        "${PROJECT_ROOT}/ssl"
        "${PROJECT_ROOT}/database/init"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        print_status $GREEN "Created directory: $dir"
    done
}

# Function to display next steps
show_next_steps() {
    print_status $GREEN "\n🎉 Environment setup completed successfully!"
    print_status $BLUE "\nNext steps:"
    
    case $ENVIRONMENT in
        development)
            print_status $YELLOW "1. Review and update .env.local if needed"
            print_status $YELLOW "2. Run: docker-compose up -d"
            print_status $YELLOW "3. Run database migrations: npm run db:migrate"
            print_status $YELLOW "4. Seed the database: npm run db:seed"
            print_status $YELLOW "5. Start development server: npm run dev"
            ;;
        staging)
            print_status $YELLOW "1. Update domain names in .env.staging"
            print_status $YELLOW "2. Configure Stripe test keys"
            print_status $YELLOW "3. Set up staging database and Redis"
            print_status $YELLOW "4. Deploy using: docker-compose -f docker-compose.staging.yml up -d"
            ;;
        production)
            print_status $RED "1. ⚠️  CRITICAL: Update all placeholder values in .env.production"
            print_status $RED "2. ⚠️  Configure Stripe LIVE keys"
            print_status $RED "3. ⚠️  Set up production database with proper backups"
            print_status $RED "4. ⚠️  Configure SSL certificates"
            print_status $YELLOW "5. Test in staging environment first"
            print_status $YELLOW "6. Deploy using production deployment script"
            ;;
    esac
    
    print_status $BLUE "\nUseful commands:"
    print_status $BLUE "- View logs: docker-compose logs -f"
    print_status $BLUE "- Reset environment: FORCE_OVERWRITE=true ./scripts/env-setup.sh $ENVIRONMENT"
    print_status $BLUE "- Check health: curl http://localhost:3000/api/health"
}

# Main execution
main() {
    print_status $GREEN "Setting up $ENVIRONMENT environment..."
    
    validate_tools
    create_directories
    create_db_init
    create_secrets_template
    
    case $ENVIRONMENT in
        development)
            create_env_file "${PROJECT_ROOT}/.env.local"
            validate_env_file "${PROJECT_ROOT}/.env.local"
            ;;
        staging)
            create_env_file "${PROJECT_ROOT}/.env.staging"
            validate_env_file "${PROJECT_ROOT}/.env.staging"
            ;;
        production)
            create_env_file "${PROJECT_ROOT}/.env.production"
            validate_env_file "${PROJECT_ROOT}/.env.production"
            ;;
    esac
    
    show_next_steps
}

# Help text
show_help() {
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments:"
    echo "  development  - Set up local development environment (default)"
    echo "  staging      - Set up staging environment"
    echo "  production   - Set up production environment"
    echo ""
    echo "Environment variables:"
    echo "  FORCE_OVERWRITE=true  - Overwrite existing environment files"
    echo ""
    echo "Examples:"
    echo "  $0                    # Set up development environment"
    echo "  $0 staging           # Set up staging environment"
    echo "  FORCE_OVERWRITE=true $0 production  # Force production setup"
}

# Handle command line arguments
case ${1:-} in
    -h|--help|help)
        show_help
        exit 0
        ;;
    development|staging|production|"")
        main
        ;;
    *)
        print_status $RED "Unknown environment: $1"
        show_help
        exit 1
        ;;
esac