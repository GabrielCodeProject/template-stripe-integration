#!/bin/bash

# Production Deployment Script for Stripe Payment Template on Leaseweb
# Handles blue-green deployment with health checks and rollback capabilities

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

# Deployment configuration
ENVIRONMENT="production"
COMPOSE_FILE="docker-compose.prod.yml"
APP_DIR="/opt/stripe-template"
BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/deployment.log"
HEALTH_CHECK_URL="http://localhost:3000/api/health"
PUBLIC_HEALTH_CHECK_URL="https://yourapp.com/api/health"
MAX_HEALTH_CHECK_ATTEMPTS=30
HEALTH_CHECK_INTERVAL=10

# Blue-green deployment configuration
CURRENT_INSTANCE=""
NEW_INSTANCE=""
ROLLBACK_ENABLED=${ROLLBACK_ENABLED:-true}
SKIP_BACKUP=${SKIP_BACKUP:-false}
SKIP_MIGRATIONS=${SKIP_MIGRATIONS:-false}
FORCE_DEPLOYMENT=${FORCE_DEPLOYMENT:-false}

# Load environment variables
if [ -f "${PROJECT_ROOT}/.env.production" ]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env.production" | xargs)
fi

# Function to print colored output with timestamp
print_status() {
    local color=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${color}[${timestamp}] ${message}${NC}"
}

# Function to log messages
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Write to log file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Print to console with color
    case $level in
        ERROR)
            print_status $RED "$message"
            ;;
        WARN)
            print_status $YELLOW "$message"
            ;;
        INFO)
            print_status $BLUE "$message"
            ;;
        SUCCESS)
            print_status $GREEN "$message"
            ;;
    esac
}

# Function to send deployment notifications
send_notification() {
    local subject=$1
    local message=$2
    local status=${3:-info}
    local webhook_data
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        case $status in
            error) color="danger" ;;
            warning) color="warning" ;;
        esac
        
        webhook_data=$(cat <<EOF
{
  "attachments": [{
    "color": "$color",
    "title": "$subject",
    "text": "$message",
    "fields": [
      {
        "title": "Environment",
        "value": "$ENVIRONMENT",
        "short": true
      },
      {
        "title": "Version",
        "value": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
        "short": true
      }
    ],
    "footer": "Stripe Template Deployment",
    "ts": $(date +%s)
  }]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$webhook_data" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
}

# Function to check deployment prerequisites
check_prerequisites() {
    log_message "INFO" "Checking deployment prerequisites..."
    
    # Check if we're in the correct directory
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_message "ERROR" "Docker Compose file not found: $COMPOSE_FILE"
        log_message "ERROR" "Make sure you're running this script from the project root"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f ".env.production" ]; then
        log_message "ERROR" "Production environment file not found: .env.production"
        log_message "ERROR" "Run ./scripts/env-setup.sh production first"
        exit 1
    fi
    
    # Check required environment variables
    local required_vars=("DATABASE_URL" "REDIS_URL" "STRIPE_SECRET_KEY" "NEXTAUTH_SECRET")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_message "ERROR" "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    # Check Docker and Docker Compose
    if ! command -v docker >/dev/null 2>&1; then
        log_message "ERROR" "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_message "ERROR" "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log_message "ERROR" "Docker daemon is not running"
        exit 1
    fi
    
    log_message "SUCCESS" "Prerequisites check passed"
}

# Function to determine current and new instances for blue-green deployment
determine_instances() {
    log_message "INFO" "Determining deployment instances..."
    
    # Check which instance is currently running
    if docker ps | grep -q "app-blue"; then
        CURRENT_INSTANCE="app-blue"
        NEW_INSTANCE="app-green"
    else
        CURRENT_INSTANCE="app-green"
        NEW_INSTANCE="app-blue"
    fi
    
    log_message "INFO" "Current instance: $CURRENT_INSTANCE"
    log_message "INFO" "New instance: $NEW_INSTANCE"
}

# Function to create deployment backup
create_deployment_backup() {
    if [ "$SKIP_BACKUP" = "true" ]; then
        log_message "WARN" "Skipping backup creation (SKIP_BACKUP=true)"
        return 0
    fi
    
    log_message "INFO" "Creating pre-deployment backup..."
    
    # Create backup using the backup script
    if [ -f "${SCRIPT_DIR}/backup.sh" ]; then
        ENVIRONMENT=production "${SCRIPT_DIR}/backup.sh" full
    else
        log_message "WARN" "Backup script not found, creating manual backup..."
        
        # Manual backup
        local backup_timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_path="${BACKUP_DIR}/pre-deployment-${backup_timestamp}"
        mkdir -p "$backup_path"
        
        # Database backup
        if docker ps | grep -q postgres; then
            docker exec postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${backup_path}/database.sql"
            gzip "${backup_path}/database.sql"
        fi
        
        # Files backup
        if [ -d "uploads" ]; then
            tar -czf "${backup_path}/uploads.tar.gz" uploads/
        fi
        
        log_message "SUCCESS" "Manual backup created: $backup_path"
    fi
}

# Function to pull latest images
pull_images() {
    log_message "INFO" "Pulling latest Docker images..."
    
    # Pull all images defined in compose file
    docker-compose -f "$COMPOSE_FILE" pull
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Docker images pulled successfully"
    else
        log_message "ERROR" "Failed to pull Docker images"
        exit 1
    fi
}

# Function to run database migrations
run_migrations() {
    if [ "$SKIP_MIGRATIONS" = "true" ]; then
        log_message "WARN" "Skipping database migrations (SKIP_MIGRATIONS=true)"
        return 0
    fi
    
    log_message "INFO" "Running database migrations..."
    
    # Ensure database is accessible
    if ! docker exec postgres pg_isready -U "${POSTGRES_USER}" >/dev/null 2>&1; then
        log_message "ERROR" "Database is not ready"
        exit 1
    fi
    
    # Run migrations using a temporary container
    docker run --rm \
        --network stripe_template_prod_network \
        -e DATABASE_URL="$DATABASE_URL" \
        -v "${PWD}:/app" \
        -w /app \
        node:18-alpine \
        sh -c "npm ci --only=production && npx prisma migrate deploy"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Database migrations completed"
    else
        log_message "ERROR" "Database migrations failed"
        exit 1
    fi
}

# Function to start new instance
start_new_instance() {
    log_message "INFO" "Starting new application instance: $NEW_INSTANCE"
    
    # Start the new instance
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps "$NEW_INSTANCE"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "New instance started: $NEW_INSTANCE"
    else
        log_message "ERROR" "Failed to start new instance: $NEW_INSTANCE"
        exit 1
    fi
}

# Function to perform health check
health_check() {
    local url=$1
    local max_attempts=${2:-$MAX_HEALTH_CHECK_ATTEMPTS}
    local interval=${3:-$HEALTH_CHECK_INTERVAL}
    local attempt=1
    
    log_message "INFO" "Performing health check on $url"
    log_message "INFO" "Max attempts: $max_attempts, Interval: ${interval}s"
    
    while [ $attempt -le $max_attempts ]; do
        log_message "INFO" "Health check attempt $attempt/$max_attempts..."
        
        if curl -f -s --connect-timeout 5 --max-time 10 "$url" >/dev/null 2>&1; then
            local health_response=$(curl -s "$url" 2>/dev/null || echo '{}')
            local status=$(echo "$health_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            
            if [ "$status" = "healthy" ] || [ "$status" = "ok" ]; then
                log_message "SUCCESS" "Health check passed (status: $status)"
                return 0
            else
                log_message "WARN" "Health check returned non-healthy status: $status"
            fi
        else
            log_message "WARN" "Health check failed (attempt $attempt/$max_attempts)"
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            sleep $interval
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_message "ERROR" "Health check failed after $max_attempts attempts"
    return 1
}

# Function to switch traffic to new instance
switch_traffic() {
    log_message "INFO" "Switching traffic to new instance..."
    
    # Update nginx configuration to point to new instance
    docker-compose -f "$COMPOSE_FILE" up -d nginx
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Traffic switched to new instance"
        
        # Wait a moment for nginx to update
        sleep 5
        
        # Verify public endpoint
        if health_check "$PUBLIC_HEALTH_CHECK_URL" 5 5; then
            log_message "SUCCESS" "Public endpoint health check passed"
            return 0
        else
            log_message "ERROR" "Public endpoint health check failed"
            return 1
        fi
    else
        log_message "ERROR" "Failed to update nginx configuration"
        return 1
    fi
}

# Function to stop old instance
stop_old_instance() {
    log_message "INFO" "Stopping old instance: $CURRENT_INSTANCE"
    
    docker-compose -f "$COMPOSE_FILE" stop "$CURRENT_INSTANCE"
    docker-compose -f "$COMPOSE_FILE" rm -f "$CURRENT_INSTANCE"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Old instance stopped: $CURRENT_INSTANCE"
    else
        log_message "WARN" "Failed to stop old instance: $CURRENT_INSTANCE"
    fi
}

# Function to rollback deployment
rollback_deployment() {
    log_message "ERROR" "Initiating deployment rollback..."
    
    if [ "$ROLLBACK_ENABLED" != "true" ]; then
        log_message "ERROR" "Rollback is disabled, manual intervention required"
        return 1
    fi
    
    # Stop the new (failed) instance
    log_message "INFO" "Stopping failed instance: $NEW_INSTANCE"
    docker-compose -f "$COMPOSE_FILE" stop "$NEW_INSTANCE" 2>/dev/null || true
    docker-compose -f "$COMPOSE_FILE" rm -f "$NEW_INSTANCE" 2>/dev/null || true
    
    # Ensure old instance is running
    log_message "INFO" "Ensuring old instance is running: $CURRENT_INSTANCE"
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps "$CURRENT_INSTANCE"
    
    # Update nginx to point back to old instance
    docker-compose -f "$COMPOSE_FILE" up -d nginx
    
    # Verify rollback
    sleep 10
    if health_check "$PUBLIC_HEALTH_CHECK_URL" 10 5; then
        log_message "SUCCESS" "Rollback completed successfully"
        send_notification "Deployment Rollback Successful" "Deployment was rolled back successfully. Old instance is serving traffic." "warning"
        return 0
    else
        log_message "ERROR" "Rollback verification failed"
        send_notification "Deployment Rollback Failed" "Critical: Both new and old instances are failing. Manual intervention required immediately." "error"
        return 1
    fi
}

# Function to cleanup old images
cleanup_old_images() {
    log_message "INFO" "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f >/dev/null 2>&1 || true
    
    # Remove unused images older than 24 hours
    docker image prune -a --filter "until=24h" -f >/dev/null 2>&1 || true
    
    log_message "SUCCESS" "Image cleanup completed"
}

# Function to verify deployment
verify_deployment() {
    log_message "INFO" "Verifying deployment..."
    
    # Test critical endpoints
    local endpoints=(
        "$PUBLIC_HEALTH_CHECK_URL"
        "https://yourapp.com/"
        "https://yourapp.com/api/health"
    )
    
    local failed_endpoints=()
    
    for endpoint in "${endpoints[@]}"; do
        if ! curl -f -s --connect-timeout 10 --max-time 15 "$endpoint" >/dev/null 2>&1; then
            failed_endpoints+=("$endpoint")
        fi
    done
    
    if [ ${#failed_endpoints[@]} -eq 0 ]; then
        log_message "SUCCESS" "All critical endpoints are responding"
        return 0
    else
        log_message "ERROR" "Failed endpoints: ${failed_endpoints[*]}"
        return 1
    fi
}

# Function to show deployment status
show_deployment_status() {
    echo ""
    log_message "INFO" "=== Deployment Status ==="
    
    # Show running containers
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(postgres|redis|app-|nginx)" || echo "No relevant containers found"
    
    # Show disk usage
    echo ""
    echo "Disk usage:"
    df -h / | tail -1
    
    # Show memory usage
    echo ""
    echo "Memory usage:"
    free -h | head -2
    
    # Show recent logs
    echo ""
    echo "Recent application logs (last 10 lines):"
    docker-compose -f "$COMPOSE_FILE" logs --tail=10 "$NEW_INSTANCE" 2>/dev/null || echo "No logs available"
    
    echo ""
}

# Function to confirm deployment
confirm_deployment() {
    if [ "$FORCE_DEPLOYMENT" = "true" ]; then
        return 0
    fi
    
    echo ""
    print_status $YELLOW "⚠️  Production Deployment Confirmation"
    print_status $YELLOW "Environment: $ENVIRONMENT"
    print_status $YELLOW "Current instance: $CURRENT_INSTANCE"
    print_status $YELLOW "New instance: $NEW_INSTANCE"
    print_status $YELLOW "Rollback enabled: $ROLLBACK_ENABLED"
    echo ""
    
    read -p "Are you sure you want to deploy to production? Type 'deploy' to continue: " -r
    if [[ ! $REPLY == "deploy" ]]; then
        log_message "INFO" "Deployment cancelled by user"
        exit 0
    fi
}

# Main deployment function
deploy() {
    local start_time=$(date +%s)
    
    log_message "INFO" "🚀 Starting production deployment..."
    
    # Pre-deployment steps
    check_prerequisites
    determine_instances
    confirm_deployment
    create_deployment_backup
    
    # Build a temporary trap for cleanup on failure
    trap 'log_message "ERROR" "Deployment interrupted"; rollback_deployment; exit 1' INT TERM
    
    # Deployment steps
    pull_images
    run_migrations
    start_new_instance
    
    # Wait for new instance to be ready
    sleep 20
    
    # Health check new instance
    local new_instance_port
    if [ "$NEW_INSTANCE" = "app-green" ]; then
        new_instance_port="3001"
    else
        new_instance_port="3000"
    fi
    
    if ! health_check "http://localhost:${new_instance_port}/api/health"; then
        log_message "ERROR" "New instance health check failed"
        rollback_deployment
        exit 1
    fi
    
    # Switch traffic
    if ! switch_traffic; then
        log_message "ERROR" "Traffic switch failed"
        rollback_deployment
        exit 1
    fi
    
    # Verify deployment
    if ! verify_deployment; then
        log_message "ERROR" "Deployment verification failed"
        rollback_deployment
        exit 1
    fi
    
    # Stop old instance
    stop_old_instance
    
    # Post-deployment cleanup
    cleanup_old_images
    
    # Calculate deployment time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Success notification
    log_message "SUCCESS" "🎉 Production deployment completed successfully in ${duration}s!"
    
    # Show final status
    show_deployment_status
    
    # Send success notification
    send_notification "Production Deployment Successful" "Deployment completed successfully in ${duration}s. New instance ($NEW_INSTANCE) is now serving traffic." "success"
    
    # Remove trap
    trap - INT TERM
}

# Function to show help
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --skip-backup       Skip pre-deployment backup"
    echo "  --skip-migrations   Skip database migrations"
    echo "  --no-rollback       Disable automatic rollback on failure"
    echo "  --force             Skip confirmation prompts"
    echo "  --help              Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  SKIP_BACKUP=true         Skip backup creation"
    echo "  SKIP_MIGRATIONS=true     Skip database migrations"
    echo "  ROLLBACK_ENABLED=false   Disable rollback"
    echo "  FORCE_DEPLOYMENT=true    Skip confirmations"
    echo ""
    echo "Examples:"
    echo "  $0                      # Standard deployment"
    echo "  $0 --force              # Skip confirmations"
    echo "  $0 --skip-backup        # Skip backup creation"
    echo "  SKIP_MIGRATIONS=true $0 # Skip migrations"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --no-rollback)
            ROLLBACK_ENABLED=false
            shift
            ;;
        --force)
            FORCE_DEPLOYMENT=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_message "ERROR" "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Change to project root
cd "$PROJECT_ROOT"

# Run deployment
deploy