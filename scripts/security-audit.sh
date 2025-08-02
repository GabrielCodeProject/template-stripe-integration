#!/bin/bash

# Security Audit Script for Stripe Payment Template
# Performs comprehensive security checks and generates audit report

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

# Audit configuration
AUDIT_DATE=$(date +%Y%m%d_%H%M%S)
AUDIT_REPORT_DIR="${PROJECT_ROOT}/security/audit-reports"
AUDIT_REPORT_FILE="${AUDIT_REPORT_DIR}/security-audit-${AUDIT_DATE}.md"
ENVIRONMENT=${ENVIRONMENT:-production}

# Severity levels
CRITICAL=0
HIGH=1
MEDIUM=2
LOW=3
INFO=4

# Counters
CRITICAL_ISSUES=0
HIGH_ISSUES=0
MEDIUM_ISSUES=0
LOW_ISSUES=0
INFO_ISSUES=0
TOTAL_CHECKS=0
PASSED_CHECKS=0

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# Function to log audit results
log_audit() {
    local severity=$1
    local check_name=$2
    local status=$3
    local details=$4
    local recommendation=${5:-""}
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    local severity_text=""
    local color=""
    
    case $severity in
        $CRITICAL)
            severity_text="CRITICAL"
            color=$RED
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
            ;;
        $HIGH)
            severity_text="HIGH"
            color=$RED
            HIGH_ISSUES=$((HIGH_ISSUES + 1))
            ;;
        $MEDIUM)
            severity_text="MEDIUM"
            color=$YELLOW
            MEDIUM_ISSUES=$((MEDIUM_ISSUES + 1))
            ;;
        $LOW)
            severity_text="LOW"
            color=$YELLOW
            LOW_ISSUES=$((LOW_ISSUES + 1))
            ;;
        $INFO)
            severity_text="INFO"
            color=$BLUE
            INFO_ISSUES=$((INFO_ISSUES + 1))
            ;;
    esac
    
    if [ "$status" = "PASS" ]; then
        color=$GREEN
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
    
    # Print to console
    print_status $color "[$severity_text] $check_name: $status"
    if [ -n "$details" ]; then
        echo "  Details: $details"
    fi
    
    # Write to report
    cat >> "$AUDIT_REPORT_FILE" << EOF

### $check_name
- **Status**: $status
- **Severity**: $severity_text
- **Details**: $details
$([ -n "$recommendation" ] && echo "- **Recommendation**: $recommendation")

EOF
}

# Function to initialize audit report
init_audit_report() {
    mkdir -p "$AUDIT_REPORT_DIR"
    
    cat > "$AUDIT_REPORT_FILE" << EOF
# Security Audit Report

**Date**: $(date)
**Environment**: $ENVIRONMENT
**Auditor**: $(whoami)@$(hostname)
**Project**: Stripe Payment Template

## Executive Summary

This report contains the results of an automated security audit performed on the Stripe Payment Template deployment.

## Audit Results

EOF
}

# Function to check file permissions
check_file_permissions() {
    print_status $BLUE "Checking file permissions..."
    
    # Check sensitive configuration files
    local sensitive_files=(
        ".env.production"
        ".env.local"
        "ssl/key.pem"
        "config/redis.conf"
    )
    
    for file in "${sensitive_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            local perms=$(stat -c %a "$PROJECT_ROOT/$file" 2>/dev/null || stat -f %A "$PROJECT_ROOT/$file" 2>/dev/null)
            if [ "$perms" -gt 600 ]; then
                log_audit $HIGH "File Permissions - $file" "FAIL" "File has permissions $perms, should be 600 or less" "chmod 600 $file"
            else
                log_audit $INFO "File Permissions - $file" "PASS" "File has secure permissions: $perms"
            fi
        fi
    done
    
    # Check for world-writable files
    local world_writable=$(find "$PROJECT_ROOT" -type f -perm -002 2>/dev/null | grep -v node_modules || true)
    if [ -n "$world_writable" ]; then
        log_audit $HIGH "World-writable Files" "FAIL" "Found world-writable files: $world_writable" "Remove world-write permissions"
    else
        log_audit $INFO "World-writable Files" "PASS" "No world-writable files found"
    fi
}

# Function to check environment variables
check_environment_security() {
    print_status $BLUE "Checking environment variable security..."
    
    # Check for default/weak secrets
    local env_file=""
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        env_file="$PROJECT_ROOT/.env.production"
    elif [ -f "$PROJECT_ROOT/.env.local" ]; then
        env_file="$PROJECT_ROOT/.env.local"
    fi
    
    if [ -n "$env_file" ]; then
        # Check NEXTAUTH_SECRET
        local nextauth_secret=$(grep "^NEXTAUTH_SECRET=" "$env_file" | cut -d'=' -f2)
        if [ -n "$nextauth_secret" ]; then
            if [[ "$nextauth_secret" == *"change-this"* ]] || [[ "$nextauth_secret" == *"secret"* ]] || [ ${#nextauth_secret} -lt 32 ]; then
                log_audit $CRITICAL "NextAuth Secret" "FAIL" "Weak or default NextAuth secret detected" "Generate strong random secret: openssl rand -base64 32"
            else
                log_audit $INFO "NextAuth Secret" "PASS" "NextAuth secret appears strong"
            fi
        fi
        
        # Check database password
        local db_password=$(grep "^POSTGRES_PASSWORD=" "$env_file" | cut -d'=' -f2)
        if [ -n "$db_password" ]; then
            if [[ "$db_password" == *"password"* ]] || [ ${#db_password} -lt 12 ]; then
                log_audit $HIGH "Database Password" "FAIL" "Weak database password detected" "Use strong random password (16+ characters)"
            else
                log_audit $INFO "Database Password" "PASS" "Database password appears strong"
            fi
        fi
        
        # Check Stripe keys
        local stripe_secret=$(grep "^STRIPE_SECRET_KEY=" "$env_file" | cut -d'=' -f2)
        if [ -n "$stripe_secret" ]; then
            if [[ "$stripe_secret" == sk_test_* ]] && [ "$ENVIRONMENT" = "production" ]; then
                log_audit $CRITICAL "Stripe Keys" "FAIL" "Test Stripe keys in production environment" "Use live Stripe keys for production"
            elif [[ "$stripe_secret" == sk_live_* ]] && [ "$ENVIRONMENT" != "production" ]; then
                log_audit $HIGH "Stripe Keys" "FAIL" "Live Stripe keys in non-production environment" "Use test keys for development/staging"
            else
                log_audit $INFO "Stripe Keys" "PASS" "Stripe keys appear correctly configured"
            fi
        fi
    else
        log_audit $HIGH "Environment File" "FAIL" "No environment file found" "Create and configure environment file"
    fi
}

# Function to check Docker security
check_docker_security() {
    print_status $BLUE "Checking Docker security..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_audit $INFO "Docker Security" "SKIP" "Docker not found"
        return
    fi
    
    # Check if containers are running as root
    local root_containers=$(docker ps --format "table {{.Names}}" --no-trunc | tail -n +2 | while read -r container; do
        if [ -n "$container" ]; then
            local user=$(docker exec "$container" whoami 2>/dev/null || echo "unknown")
            if [ "$user" = "root" ]; then
                echo "$container"
            fi
        fi
    done)
    
    if [ -n "$root_containers" ]; then
        log_audit $MEDIUM "Docker Root Containers" "FAIL" "Containers running as root: $root_containers" "Configure containers to run as non-root user"
    else
        log_audit $INFO "Docker Root Containers" "PASS" "No containers running as root"
    fi
    
    # Check for privileged containers
    local privileged_containers=$(docker ps --filter "label=privileged=true" --format "{{.Names}}" 2>/dev/null || true)
    if [ -n "$privileged_containers" ]; then
        log_audit $HIGH "Privileged Containers" "FAIL" "Privileged containers found: $privileged_containers" "Remove privileged mode unless absolutely necessary"
    else
        log_audit $INFO "Privileged Containers" "PASS" "No privileged containers found"
    fi
    
    # Check Docker daemon configuration
    if [ -f "/etc/docker/daemon.json" ]; then
        local live_restore=$(jq -r '.["live-restore"] // false' /etc/docker/daemon.json)
        if [ "$live_restore" = "true" ]; then
            log_audit $INFO "Docker Live Restore" "PASS" "Live restore enabled"
        else
            log_audit $LOW "Docker Live Restore" "FAIL" "Live restore not enabled" "Enable live-restore in daemon.json"
        fi
    fi
}

# Function to check SSL/TLS configuration
check_ssl_security() {
    print_status $BLUE "Checking SSL/TLS security..."
    
    # Check certificate files
    local ssl_path="$PROJECT_ROOT/ssl"
    if [ -d "$ssl_path" ]; then
        if [ -f "$ssl_path/cert.pem" ] && [ -f "$ssl_path/key.pem" ]; then
            # Check certificate expiry
            local expiry_date=$(openssl x509 -in "$ssl_path/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2)
            if [ -n "$expiry_date" ]; then
                local expiry_timestamp=$(date -d "$expiry_date" +%s)
                local current_timestamp=$(date +%s)
                local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
                
                if [ "$days_until_expiry" -lt 7 ]; then
                    log_audit $CRITICAL "SSL Certificate Expiry" "FAIL" "Certificate expires in $days_until_expiry days" "Renew SSL certificate immediately"
                elif [ "$days_until_expiry" -lt 30 ]; then
                    log_audit $HIGH "SSL Certificate Expiry" "FAIL" "Certificate expires in $days_until_expiry days" "Plan certificate renewal"
                else
                    log_audit $INFO "SSL Certificate Expiry" "PASS" "Certificate valid for $days_until_expiry days"
                fi
            fi
            
            # Check certificate key strength
            local key_size=$(openssl rsa -in "$ssl_path/key.pem" -text -noout 2>/dev/null | grep "Private-Key" | grep -o '[0-9]*' | head -1)
            if [ "$key_size" -lt 2048 ]; then
                log_audit $HIGH "SSL Key Strength" "FAIL" "SSL key size is $key_size bits" "Use 2048-bit or stronger SSL keys"
            else
                log_audit $INFO "SSL Key Strength" "PASS" "SSL key strength: $key_size bits"
            fi
        else
            log_audit $HIGH "SSL Certificates" "FAIL" "SSL certificate files not found" "Configure SSL certificates"
        fi
    else
        log_audit $MEDIUM "SSL Configuration" "FAIL" "SSL directory not found" "Set up SSL certificates"
    fi
}

# Function to check network security
check_network_security() {
    print_status $BLUE "Checking network security..."
    
    # Check for open ports
    local open_ports=$(netstat -tuln 2>/dev/null | grep LISTEN | awk '{print $4}' | cut -d: -f2 | sort -n | uniq)
    local dangerous_ports=("23" "21" "135" "139" "445" "1433" "3389")
    
    for port in $open_ports; do
        for dangerous in "${dangerous_ports[@]}"; do
            if [ "$port" = "$dangerous" ]; then
                log_audit $HIGH "Dangerous Open Port" "FAIL" "Port $port is open" "Close unnecessary ports or restrict access"
            fi
        done
    done
    
    # Check if SSH is on default port
    if echo "$open_ports" | grep -q "^22$"; then
        log_audit $MEDIUM "SSH Default Port" "FAIL" "SSH running on default port 22" "Change SSH to non-standard port"
    fi
    
    # Check firewall status
    if command -v ufw >/dev/null 2>&1; then
        local ufw_status=$(ufw status | head -1)
        if echo "$ufw_status" | grep -q "inactive"; then
            log_audit $HIGH "Firewall Status" "FAIL" "UFW firewall is inactive" "Enable and configure UFW firewall"
        else
            log_audit $INFO "Firewall Status" "PASS" "UFW firewall is active"
        fi
    fi
}

# Function to check application security
check_application_security() {
    print_status $BLUE "Checking application security..."
    
    # Check package vulnerabilities
    if [ -f "$PROJECT_ROOT/package.json" ] && command -v npm >/dev/null 2>&1; then
        cd "$PROJECT_ROOT"
        local audit_output=$(npm audit --json 2>/dev/null || echo '{}')
        local vulnerabilities=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities // {} | to_entries[] | select(.value > 0) | "\(.key): \(.value)"' 2>/dev/null || true)
        
        if [ -n "$vulnerabilities" ]; then
            log_audit $HIGH "Package Vulnerabilities" "FAIL" "npm audit found vulnerabilities: $vulnerabilities" "Run npm audit fix"
        else
            log_audit $INFO "Package Vulnerabilities" "PASS" "No npm vulnerabilities found"
        fi
    fi
    
    # Check for hardcoded secrets in code
    local secret_patterns=("password\s*=" "secret\s*=" "key\s*=" "token\s*=" "api_key\s*=")
    local found_secrets=""
    
    for pattern in "${secret_patterns[@]}"; do
        local matches=$(grep -r -i "$pattern" "$PROJECT_ROOT/src" 2>/dev/null | grep -v ".test." | head -5 || true)
        if [ -n "$matches" ]; then
            found_secrets="$found_secrets\n$matches"
        fi
    done
    
    if [ -n "$found_secrets" ]; then
        log_audit $HIGH "Hardcoded Secrets" "FAIL" "Potential hardcoded secrets found" "Review code and move secrets to environment variables"
    else
        log_audit $INFO "Hardcoded Secrets" "PASS" "No obvious hardcoded secrets found"
    fi
    
    # Check Next.js security headers
    if [ -f "$PROJECT_ROOT/next.config.js" ] || [ -f "$PROJECT_ROOT/next.config.ts" ]; then
        local config_file=""
        [ -f "$PROJECT_ROOT/next.config.js" ] && config_file="next.config.js"
        [ -f "$PROJECT_ROOT/next.config.ts" ] && config_file="next.config.ts"
        
        if grep -q "X-Frame-Options\|X-Content-Type-Options\|X-XSS-Protection" "$PROJECT_ROOT/$config_file"; then
            log_audit $INFO "Security Headers" "PASS" "Security headers configured in Next.js config"
        else
            log_audit $MEDIUM "Security Headers" "FAIL" "Security headers not configured" "Add security headers to Next.js configuration"
        fi
    fi
}

# Function to check database security
check_database_security() {
    print_status $BLUE "Checking database security..."
    
    # Check if database is accessible externally
    if netstat -tuln 2>/dev/null | grep -q ":5432.*0.0.0.0"; then
        log_audit $HIGH "Database External Access" "FAIL" "PostgreSQL accessible from all interfaces" "Restrict database access to localhost or internal networks"
    else
        log_audit $INFO "Database External Access" "PASS" "PostgreSQL not accessible externally"
    fi
    
    # Check database connection encryption
    if docker ps | grep -q postgres; then
        # This is a basic check - in a real audit, you'd connect and check SSL settings
        log_audit $INFO "Database Encryption" "INFO" "Database running in container - verify SSL configuration"
    fi
}

# Function to check backup security
check_backup_security() {
    print_status $BLUE "Checking backup security..."
    
    local backup_dir="$PROJECT_ROOT/backups"
    if [ -d "$backup_dir" ]; then
        # Check backup file permissions
        local insecure_backups=$(find "$backup_dir" -type f -perm -044 2>/dev/null || true)
        if [ -n "$insecure_backups" ]; then
            log_audit $MEDIUM "Backup File Permissions" "FAIL" "Backup files readable by others" "Restrict backup file permissions (chmod 600)"
        else
            log_audit $INFO "Backup File Permissions" "PASS" "Backup files properly secured"
        fi
        
        # Check for encrypted backups
        local encrypted_backups=$(find "$backup_dir" -name "*.gpg" -o -name "*.enc" 2>/dev/null | wc -l)
        local total_backups=$(find "$backup_dir" -type f 2>/dev/null | wc -l)
        
        if [ "$total_backups" -gt 0 ] && [ "$encrypted_backups" -eq 0 ]; then
            log_audit $MEDIUM "Backup Encryption" "FAIL" "Backups are not encrypted" "Enable backup encryption"
        elif [ "$encrypted_backups" -gt 0 ]; then
            log_audit $INFO "Backup Encryption" "PASS" "Some backups are encrypted"
        fi
    else
        log_audit $LOW "Backup Directory" "FAIL" "Backup directory not found" "Set up automated backups"
    fi
}

# Function to check monitoring security
check_monitoring_security() {
    print_status $BLUE "Checking monitoring security..."
    
    # Check for exposed monitoring endpoints
    local monitoring_ports=("9090" "3001" "9093")  # Prometheus, Grafana, AlertManager
    
    for port in "${monitoring_ports[@]}"; do
        if netstat -tuln 2>/dev/null | grep -q ":$port.*0.0.0.0"; then
            log_audit $MEDIUM "Monitoring Endpoint Exposure" "FAIL" "Monitoring service on port $port accessible externally" "Restrict monitoring access to internal networks"
        fi
    done
    
    # Check for default credentials
    if [ -f "$PROJECT_ROOT/monitoring/docker-compose.yml" ]; then
        if grep -q "admin123\|admin:admin\|root:root" "$PROJECT_ROOT/monitoring/docker-compose.yml"; then
            log_audit $HIGH "Default Monitoring Credentials" "FAIL" "Default credentials found in monitoring config" "Change default monitoring credentials"
        else
            log_audit $INFO "Default Monitoring Credentials" "PASS" "No default credentials found"
        fi
    fi
}

# Function to generate audit summary
generate_audit_summary() {
    local total_issues=$((CRITICAL_ISSUES + HIGH_ISSUES + MEDIUM_ISSUES + LOW_ISSUES))
    local pass_percentage=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    
    cat >> "$AUDIT_REPORT_FILE" << EOF

## Summary

- **Total Checks**: $TOTAL_CHECKS
- **Passed Checks**: $PASSED_CHECKS ($pass_percentage%)
- **Total Issues**: $total_issues

### Issues by Severity
- **Critical**: $CRITICAL_ISSUES
- **High**: $HIGH_ISSUES
- **Medium**: $MEDIUM_ISSUES
- **Low**: $LOW_ISSUES
- **Info**: $INFO_ISSUES

### Risk Assessment
EOF

    if [ $CRITICAL_ISSUES -gt 0 ]; then
        echo "- **Overall Risk**: CRITICAL - Immediate action required" >> "$AUDIT_REPORT_FILE"
    elif [ $HIGH_ISSUES -gt 0 ]; then
        echo "- **Overall Risk**: HIGH - Action required within 24 hours" >> "$AUDIT_REPORT_FILE"
    elif [ $MEDIUM_ISSUES -gt 0 ]; then
        echo "- **Overall Risk**: MEDIUM - Action required within 1 week" >> "$AUDIT_REPORT_FILE"
    elif [ $LOW_ISSUES -gt 0 ]; then
        echo "- **Overall Risk**: LOW - Action required within 1 month" >> "$AUDIT_REPORT_FILE"
    else
        echo "- **Overall Risk**: MINIMAL - Continue monitoring" >> "$AUDIT_REPORT_FILE"
    fi
    
    cat >> "$AUDIT_REPORT_FILE" << EOF

## Next Steps

1. **Immediate**: Address all CRITICAL issues
2. **Short-term**: Resolve HIGH severity issues
3. **Medium-term**: Fix MEDIUM severity issues
4. **Long-term**: Address LOW severity findings
5. **Ongoing**: Implement regular security audits

---

*Audit completed on $(date)*
*Report generated by: $0*
EOF
}

# Function to show help
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --environment ENV    Set environment (development/staging/production)"
    echo "  --report-only        Generate report without console output"
    echo "  --help               Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT          Target environment for audit"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run audit on current environment"
    echo "  $0 --environment production  # Audit production environment"
    echo "  $0 --report-only            # Generate report silently"
}

# Parse command line arguments
REPORT_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            ENVIRONMENT=$2
            shift 2
            ;;
        --report-only)
            REPORT_ONLY=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main audit function
main() {
    if [ "$REPORT_ONLY" = "false" ]; then
        print_status $GREEN "🔍 Starting security audit for $ENVIRONMENT environment..."
        echo ""
    fi
    
    # Initialize audit report
    init_audit_report
    
    # Run security checks
    check_file_permissions
    check_environment_security
    check_docker_security
    check_ssl_security
    check_network_security
    check_application_security
    check_database_security
    check_backup_security
    check_monitoring_security
    
    # Generate summary
    generate_audit_summary
    
    if [ "$REPORT_ONLY" = "false" ]; then
        echo ""
        print_status $GREEN "🎉 Security audit completed!"
        echo ""
        print_status $BLUE "Audit Summary:"
        echo "  Total Checks: $TOTAL_CHECKS"
        echo "  Passed: $PASSED_CHECKS"
        echo "  Critical Issues: $CRITICAL_ISSUES"
        echo "  High Issues: $HIGH_ISSUES"
        echo "  Medium Issues: $MEDIUM_ISSUES"
        echo "  Low Issues: $LOW_ISSUES"
        echo ""
        print_status $BLUE "Full report saved to: $AUDIT_REPORT_FILE"
        
        # Show next steps based on findings
        if [ $CRITICAL_ISSUES -gt 0 ]; then
            print_status $RED "⚠️  CRITICAL ISSUES FOUND - Immediate action required!"
        elif [ $HIGH_ISSUES -gt 0 ]; then
            print_status $YELLOW "⚠️  HIGH SEVERITY ISSUES - Action required within 24 hours"
        fi
    fi
}

# Run the audit
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi