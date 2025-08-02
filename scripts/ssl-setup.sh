#!/bin/bash

# SSL Certificate Setup and Automation Script for Stripe Payment Template
# Handles Let's Encrypt SSL certificates with automatic renewal

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

# Default configuration
DOMAIN=${1:-""}
EMAIL=${2:-""}
ENVIRONMENT=${ENVIRONMENT:-production}
WEBROOT_PATH=${WEBROOT_PATH:-/var/www/certbot}
SSL_PATH=${SSL_PATH:-/opt/stripe-template/ssl}
NGINX_CONF_PATH=${NGINX_CONF_PATH:-/opt/stripe-template/config/nginx}
DRY_RUN=${DRY_RUN:-false}
FORCE_RENEWAL=${FORCE_RENEWAL:-false}
STAGING=${STAGING:-false}

# Auto-renewal configuration
RENEWAL_ENABLED=${RENEWAL_ENABLED:-true}
RENEWAL_TIME=${RENEWAL_TIME:-"0 3 * * *"}  # Daily at 3 AM
RENEWAL_HOOK_ENABLED=${RENEWAL_HOOK_ENABLED:-true}

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# Function to log messages
log_message() {
    local level=$1
    local message=$2
    
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

# Function to validate input parameters
validate_input() {
    if [ -z "$DOMAIN" ]; then
        log_message "ERROR" "Domain name is required"
        show_help
        exit 1
    fi
    
    if [ -z "$EMAIL" ]; then
        log_message "ERROR" "Email address is required for Let's Encrypt registration"
        show_help
        exit 1
    fi
    
    # Validate email format
    if ! echo "$EMAIL" | grep -E '^[^@]+@[^@]+\.[^@]+$' >/dev/null; then
        log_message "ERROR" "Invalid email format: $EMAIL"
        exit 1
    fi
    
    # Validate domain format
    if ! echo "$DOMAIN" | grep -E '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$' >/dev/null; then
        log_message "ERROR" "Invalid domain format: $DOMAIN"
        exit 1
    fi
    
    log_message "SUCCESS" "Input validation passed"
}

# Function to check prerequisites
check_prerequisites() {
    log_message "INFO" "Checking SSL setup prerequisites..."
    
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        log_message "ERROR" "This script must be run as root or with sudo"
        exit 1
    fi
    
    # Check if certbot is installed
    if ! command -v certbot >/dev/null 2>&1; then
        log_message "INFO" "Installing certbot..."
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update
            apt-get install -y certbot python3-certbot-nginx
        elif command -v yum >/dev/null 2>&1; then
            yum install -y certbot python3-certbot-nginx
        else
            log_message "ERROR" "Unsupported package manager. Please install certbot manually."
            exit 1
        fi
    fi
    
    # Check if nginx is available
    if ! command -v nginx >/dev/null 2>&1; then
        log_message "WARN" "Nginx not found in PATH, assuming Docker-based setup"
    fi
    
    # Create necessary directories
    mkdir -p "$SSL_PATH"
    mkdir -p "$WEBROOT_PATH"
    mkdir -p "/var/log/letsencrypt"
    
    log_message "SUCCESS" "Prerequisites check passed"
}

# Function to check DNS resolution
check_dns() {
    log_message "INFO" "Checking DNS resolution for $DOMAIN..."
    
    local public_ip=$(curl -s https://ipv4.icanhazip.com/ || curl -s https://api.ipify.org/)
    local domain_ip=$(dig +short "$DOMAIN" @8.8.8.8)
    
    if [ -z "$domain_ip" ]; then
        log_message "ERROR" "DNS resolution failed for $DOMAIN"
        log_message "ERROR" "Please ensure the domain points to this server's IP: $public_ip"
        exit 1
    fi
    
    if [ "$domain_ip" != "$public_ip" ]; then
        log_message "WARN" "Domain IP ($domain_ip) doesn't match server IP ($public_ip)"
        log_message "WARN" "SSL certificate generation may fail"
        
        if [ "$FORCE_RENEWAL" != "true" ]; then
            read -p "Continue anyway? [y/N]: " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        log_message "SUCCESS" "DNS resolution check passed"
    fi
}

# Function to setup nginx for ACME challenge
setup_nginx_acme() {
    log_message "INFO" "Setting up Nginx for ACME challenge..."
    
    # Create temporary nginx configuration for ACME challenge
    local temp_conf="/tmp/acme-challenge.conf"
    
    cat > "$temp_conf" << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root $WEBROOT_PATH;
        try_files \$uri =404;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    
    # Check if we're using Docker-based nginx
    if docker ps | grep -q nginx; then
        log_message "INFO" "Detected Docker-based Nginx setup"
        
        # Copy config to nginx container
        docker cp "$temp_conf" nginx:/etc/nginx/conf.d/acme-challenge.conf
        
        # Test and reload nginx
        docker exec nginx nginx -t
        docker exec nginx nginx -s reload
    else
        # Traditional nginx setup
        cp "$temp_conf" /etc/nginx/sites-available/acme-challenge
        ln -sf /etc/nginx/sites-available/acme-challenge /etc/nginx/sites-enabled/
        
        nginx -t
        systemctl reload nginx
    fi
    
    rm -f "$temp_conf"
    log_message "SUCCESS" "Nginx configured for ACME challenge"
}

# Function to obtain SSL certificate
obtain_certificate() {
    log_message "INFO" "Obtaining SSL certificate for $DOMAIN..."
    
    # Build certbot command
    local certbot_cmd="certbot certonly --webroot"
    certbot_cmd="$certbot_cmd --webroot-path=$WEBROOT_PATH"
    certbot_cmd="$certbot_cmd --email $EMAIL"
    certbot_cmd="$certbot_cmd --agree-tos"
    certbot_cmd="$certbot_cmd --no-eff-email"
    certbot_cmd="$certbot_cmd --domains $DOMAIN"
    
    # Add staging flag if enabled
    if [ "$STAGING" = "true" ]; then
        certbot_cmd="$certbot_cmd --staging"
        log_message "INFO" "Using Let's Encrypt staging environment"
    fi
    
    # Add dry-run flag if enabled
    if [ "$DRY_RUN" = "true" ]; then
        certbot_cmd="$certbot_cmd --dry-run"
        log_message "INFO" "Performing dry run"
    fi
    
    # Add force renewal if enabled
    if [ "$FORCE_RENEWAL" = "true" ]; then
        certbot_cmd="$certbot_cmd --force-renewal"
    fi
    
    # Execute certbot command
    log_message "INFO" "Running: $certbot_cmd"
    $certbot_cmd
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "SSL certificate obtained successfully"
        return 0
    else
        log_message "ERROR" "Failed to obtain SSL certificate"
        return 1
    fi
}

# Function to copy certificates to application directory
copy_certificates() {
    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "DRY RUN: Would copy certificates to $SSL_PATH"
        return 0
    fi
    
    log_message "INFO" "Copying certificates to application directory..."
    
    local cert_path="/etc/letsencrypt/live/$DOMAIN"
    
    if [ ! -d "$cert_path" ]; then
        log_message "ERROR" "Certificate directory not found: $cert_path"
        return 1
    fi
    
    # Copy certificates
    cp "$cert_path/fullchain.pem" "$SSL_PATH/cert.pem"
    cp "$cert_path/privkey.pem" "$SSL_PATH/key.pem"
    cp "$cert_path/chain.pem" "$SSL_PATH/chain.pem"
    
    # Set proper permissions
    chmod 644 "$SSL_PATH/cert.pem"
    chmod 644 "$SSL_PATH/chain.pem"
    chmod 600 "$SSL_PATH/key.pem"
    
    # Set ownership if deploy user exists
    if id "deploy" &>/dev/null; then
        chown deploy:deploy "$SSL_PATH"/*.pem
    fi
    
    log_message "SUCCESS" "Certificates copied to $SSL_PATH"
}

# Function to update nginx configuration for SSL
update_nginx_ssl() {
    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "DRY RUN: Would update Nginx SSL configuration"
        return 0
    fi
    
    log_message "INFO" "Updating Nginx configuration for SSL..."
    
    local ssl_conf="$NGINX_CONF_PATH/conf.d/ssl-$DOMAIN.conf"
    
    # Create SSL-specific configuration
    cat > "$ssl_conf" << EOF
# SSL Configuration for $DOMAIN
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;
    
    # SSL certificate files
    ssl_certificate $SSL_PATH/cert.pem;
    ssl_certificate_key $SSL_PATH/key.pem;
    ssl_trusted_certificate $SSL_PATH/chain.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # ACME challenge location
    location /.well-known/acme-challenge/ {
        root $WEBROOT_PATH;
        try_files \$uri =404;
    }
    
    # Proxy to application
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_cache_bypass \$http_upgrade;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
    # ACME challenge location
    location /.well-known/acme-challenge/ {
        root $WEBROOT_PATH;
        try_files \$uri =404;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    
    # Test nginx configuration
    if docker ps | grep -q nginx; then
        docker exec nginx nginx -t
        if [ $? -eq 0 ]; then
            docker exec nginx nginx -s reload
            log_message "SUCCESS" "Nginx SSL configuration updated"
        else
            log_message "ERROR" "Nginx configuration test failed"
            return 1
        fi
    else
        nginx -t
        if [ $? -eq 0 ]; then
            systemctl reload nginx
            log_message "SUCCESS" "Nginx SSL configuration updated"
        else
            log_message "ERROR" "Nginx configuration test failed"
            return 1
        fi
    fi
}

# Function to setup automatic renewal
setup_auto_renewal() {
    if [ "$RENEWAL_ENABLED" != "true" ]; then
        log_message "INFO" "Automatic renewal disabled"
        return 0
    fi
    
    log_message "INFO" "Setting up automatic certificate renewal..."
    
    # Create renewal script
    local renewal_script="/opt/ssl-renewal.sh"
    
    cat > "$renewal_script" << EOF
#!/bin/bash
# Automatic SSL certificate renewal script for $DOMAIN

set -e

# Logging
LOG_FILE="/var/log/ssl-renewal.log"
exec > >(tee -a "\$LOG_FILE")
exec 2>&1

echo "[$(date)] Starting SSL certificate renewal check for $DOMAIN"

# Renew certificates
certbot renew --quiet --webroot --webroot-path=$WEBROOT_PATH

# Check if renewal occurred
if [ \$? -eq 0 ]; then
    echo "[$(date)] Certificate renewal check completed"
    
    # Copy certificates to application directory
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_PATH/cert.pem
        cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_PATH/key.pem
        cp /etc/letsencrypt/live/$DOMAIN/chain.pem $SSL_PATH/chain.pem
        
        # Set proper permissions
        chmod 644 $SSL_PATH/cert.pem $SSL_PATH/chain.pem
        chmod 600 $SSL_PATH/key.pem
        
        if id "deploy" &>/dev/null; then
            chown deploy:deploy $SSL_PATH/*.pem
        fi
        
        echo "[$(date)] Certificates updated"
        
        # Reload nginx
        if docker ps | grep -q nginx; then
            docker exec nginx nginx -s reload
            echo "[$(date)] Nginx reloaded (Docker)"
        elif systemctl is-active --quiet nginx; then
            systemctl reload nginx
            echo "[$(date)] Nginx reloaded (systemd)"
        fi
        
        # Send notification if webhook is configured
        if [ -n "\$SLACK_WEBHOOK_URL" ]; then
            curl -X POST -H 'Content-type: application/json' \\
                --data '{"text":"SSL certificate renewed for $DOMAIN"}' \\
                "\$SLACK_WEBHOOK_URL" || true
        fi
    fi
else
    echo "[$(date)] Certificate renewal failed"
    
    # Send error notification
    if [ -n "\$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \\
            --data '{"text":"⚠️ SSL certificate renewal failed for $DOMAIN"}' \\
            "\$SLACK_WEBHOOK_URL" || true
    fi
fi

echo "[$(date)] SSL renewal check completed"
EOF
    
    chmod +x "$renewal_script"
    
    # Add to crontab
    local cron_entry="$RENEWAL_TIME $renewal_script"
    
    # Check if entry already exists
    if ! crontab -l 2>/dev/null | grep -q "$renewal_script"; then
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        log_message "SUCCESS" "Automatic renewal scheduled: $RENEWAL_TIME"
    else
        log_message "INFO" "Automatic renewal already configured"
    fi
    
    # Create logrotate configuration for renewal logs
    cat > /etc/logrotate.d/ssl-renewal << EOF
/var/log/ssl-renewal.log {
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF
    
    log_message "SUCCESS" "Automatic renewal setup completed"
}

# Function to test SSL configuration
test_ssl() {
    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "DRY RUN: Would test SSL configuration"
        return 0
    fi
    
    log_message "INFO" "Testing SSL configuration..."
    
    # Wait a moment for nginx to apply changes
    sleep 5
    
    # Test HTTPS connection
    if curl -fs --connect-timeout 10 "https://$DOMAIN/" >/dev/null 2>&1; then
        log_message "SUCCESS" "HTTPS connection test passed"
    else
        log_message "WARN" "HTTPS connection test failed - this may be normal if the application isn't running"
    fi
    
    # Test SSL certificate
    local cert_info=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [ -n "$cert_info" ]; then
        log_message "SUCCESS" "SSL certificate is valid"
        echo "$cert_info"
    else
        log_message "WARN" "Could not retrieve SSL certificate information"
    fi
    
    # Test certificate expiry
    local expiry_date=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -n "$expiry_date" ]; then
        local expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        log_message "INFO" "Certificate expires in $days_until_expiry days"
        
        if [ "$days_until_expiry" -lt 30 ]; then
            log_message "WARN" "Certificate expires soon!"
        fi
    fi
}

# Function to show certificate information
show_cert_info() {
    log_message "INFO" "SSL Certificate Information:"
    
    if [ -f "$SSL_PATH/cert.pem" ]; then
        echo ""
        echo "Certificate Details:"
        openssl x509 -in "$SSL_PATH/cert.pem" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:|DNS:)"
        echo ""
        
        echo "Certificate Files:"
        ls -la "$SSL_PATH"/*.pem 2>/dev/null || echo "No certificate files found"
        echo ""
    else
        log_message "WARN" "Certificate files not found in $SSL_PATH"
    fi
    
    # Show renewal cron job
    echo "Automatic Renewal:"
    crontab -l 2>/dev/null | grep ssl-renewal || echo "No automatic renewal configured"
    echo ""
}

# Function to show help
show_help() {
    echo "Usage: $0 <domain> <email> [options]"
    echo ""
    echo "Arguments:"
    echo "  domain              Domain name for SSL certificate"
    echo "  email               Email address for Let's Encrypt registration"
    echo ""
    echo "Options:"
    echo "  --staging           Use Let's Encrypt staging environment"
    echo "  --dry-run           Perform a test run without making changes"
    echo "  --force             Force certificate renewal"
    echo "  --no-auto-renewal   Disable automatic renewal setup"
    echo "  --info              Show certificate information"
    echo "  --help              Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  WEBROOT_PATH=/var/www/certbot    Path for ACME challenge"
    echo "  SSL_PATH=/opt/stripe-template/ssl Path to store certificates"
    echo "  RENEWAL_TIME='0 3 * * *'         Cron schedule for renewal"
    echo ""
    echo "Examples:"
    echo "  $0 example.com admin@example.com"
    echo "  $0 staging.example.com admin@example.com --staging"
    echo "  $0 example.com admin@example.com --dry-run"
    echo "  $0 example.com admin@example.com --force"
    echo "  $0 --info  # Show certificate information"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --staging)
            STAGING=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE_RENEWAL=true
            shift
            ;;
        --no-auto-renewal)
            RENEWAL_ENABLED=false
            shift
            ;;
        --info)
            show_cert_info
            exit 0
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            if [ -z "$DOMAIN" ]; then
                DOMAIN=$1
            elif [ -z "$EMAIL" ]; then
                EMAIL=$1
            else
                log_message "ERROR" "Unknown option: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# Main execution
main() {
    log_message "INFO" "🔒 Starting SSL certificate setup for $DOMAIN..."
    
    validate_input
    check_prerequisites
    check_dns
    setup_nginx_acme
    
    if obtain_certificate; then
        copy_certificates
        update_nginx_ssl
        setup_auto_renewal
        test_ssl
        
        log_message "SUCCESS" "🎉 SSL certificate setup completed successfully!"
        
        if [ "$DRY_RUN" != "true" ]; then
            show_cert_info
        fi
        
        echo ""
        log_message "INFO" "Next steps:"
        echo "1. Verify HTTPS is working: https://$DOMAIN"
        echo "2. Test automatic renewal: sudo /opt/ssl-renewal.sh"
        echo "3. Monitor renewal logs: tail -f /var/log/ssl-renewal.log"
        echo ""
    else
        log_message "ERROR" "SSL certificate setup failed"
        exit 1
    fi
}

# Handle help and info commands
if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
    show_help
    exit 0
elif [ "$1" = "--info" ] || [ "$1" = "info" ]; then
    show_cert_info
    exit 0
fi

# Run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi