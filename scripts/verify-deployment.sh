#!/bin/bash

# Production Deployment Verification Script for Stripe Payment Template
# Comprehensive testing suite to verify deployment health and functionality

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
ENVIRONMENT=${ENVIRONMENT:-production}
BASE_URL=${BASE_URL:-""}
TIMEOUT=${TIMEOUT:-30}
VERBOSE=${VERBOSE:-false}
SKIP_EXTERNAL=${SKIP_EXTERNAL:-false}
REPORT_FILE=""

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Critical endpoints that must be working
CRITICAL_ENDPOINTS=(
    "/api/health"
    "/"
)

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%H:%M:%S')] ${message}${NC}"
}

# Function to log test results
log_test() {
    local test_name=$1
    local status=$2
    local details=${3:-""}
    local duration=${4:-""}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case $status in
        PASS)
            PASSED_TESTS=$((PASSED_TESTS + 1))
            print_status $GREEN "✓ $test_name"
            ;;
        FAIL)
            FAILED_TESTS=$((FAILED_TESTS + 1))
            print_status $RED "✗ $test_name"
            ;;
        SKIP)
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            print_status $YELLOW "- $test_name (SKIPPED)"
            ;;
    esac
    
    if [ "$VERBOSE" = "true" ] && [ -n "$details" ]; then
        echo "  Details: $details"
    fi
    
    if [ -n "$duration" ] && [ "$VERBOSE" = "true" ]; then
        echo "  Duration: ${duration}ms"
    fi
    
    # Write to report if specified
    if [ -n "$REPORT_FILE" ]; then
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        echo "[$timestamp] $status: $test_name - $details" >> "$REPORT_FILE"
    fi
}

# Function to make HTTP request with timeout
http_request() {
    local url=$1
    local method=${2:-GET}
    local expected_code=${3:-200}
    local timeout=${4:-$TIMEOUT}
    local headers=${5:-""}
    
    local start_time=$(date +%s%3N)
    local response
    local status_code
    local duration
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" -m "$timeout" -H "$headers" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -m "$timeout" "$url" 2>/dev/null)
    fi
    
    local end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    
    if [ $? -eq 0 ]; then
        status_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')
        
        if [ "$status_code" = "$expected_code" ]; then
            echo "$body|$status_code|$duration"
            return 0
        else
            echo "|$status_code|$duration"
            return 1
        fi
    else
        echo "||$duration"
        return 1
    fi
}

# Function to test basic connectivity
test_basic_connectivity() {
    print_status $BLUE "Testing basic connectivity..."
    
    # Test if base URL is reachable
    local result=$(http_request "$BASE_URL" "GET" "200" 10)
    local status_code=$(echo "$result" | cut -d'|' -f2)
    local duration=$(echo "$result" | cut -d'|' -f3)
    
    if [ -n "$status_code" ] && [ "$status_code" = "200" ]; then
        log_test "Basic HTTP connectivity" "PASS" "Status: $status_code" "$duration"
    else
        log_test "Basic HTTP connectivity" "FAIL" "Status: ${status_code:-timeout}"
    fi
    
    # Test HTTPS if different from HTTP
    if [[ "$BASE_URL" == http://* ]]; then
        local https_url=$(echo "$BASE_URL" | sed 's/http:/https:/')
        local https_result=$(http_request "$https_url" "GET" "200" 10)
        local https_status=$(echo "$https_result" | cut -d'|' -f2)
        
        if [ -n "$https_status" ] && [ "$https_status" = "200" ]; then
            log_test "HTTPS connectivity" "PASS" "Status: $https_status"
        else
            log_test "HTTPS connectivity" "FAIL" "Status: ${https_status:-timeout}"
        fi
    fi
}

# Function to test health endpoints
test_health_endpoints() {
    print_status $BLUE "Testing health endpoints..."
    
    # Test main health endpoint
    local health_result=$(http_request "$BASE_URL/api/health" "GET" "200")
    local health_body=$(echo "$health_result" | cut -d'|' -f1)
    local health_status=$(echo "$health_result" | cut -d'|' -f2)
    local health_duration=$(echo "$health_result" | cut -d'|' -f3)
    
    if [ -n "$health_status" ] && [ "$health_status" = "200" ]; then
        # Parse health response
        local overall_status=$(echo "$health_body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        if [ "$overall_status" = "healthy" ] || [ "$overall_status" = "ok" ]; then
            log_test "Health endpoint status" "PASS" "Overall status: $overall_status" "$health_duration"
        else
            log_test "Health endpoint status" "FAIL" "Overall status: $overall_status"
        fi
        
        # Check individual service health
        if echo "$health_body" | grep -q '"database":"healthy"'; then
            log_test "Database health check" "PASS" "Database is healthy"
        else
            log_test "Database health check" "FAIL" "Database health check failed"
        fi
        
        if echo "$health_body" | grep -q '"redis":"healthy"'; then
            log_test "Redis health check" "PASS" "Redis is healthy"
        else
            log_test "Redis health check" "FAIL" "Redis health check failed"
        fi
        
    else
        log_test "Health endpoint" "FAIL" "Status: ${health_status:-timeout}"
    fi
    
    # Test readiness endpoint
    local ready_result=$(http_request "$BASE_URL/api/health" "HEAD" "200")
    local ready_status=$(echo "$ready_result" | cut -d'|' -f2)
    
    if [ -n "$ready_status" ] && [ "$ready_status" = "200" ]; then
        log_test "Readiness endpoint" "PASS" "Service is ready"
    else
        log_test "Readiness endpoint" "FAIL" "Status: ${ready_status:-timeout}"
    fi
}

# Function to test critical application endpoints
test_critical_endpoints() {
    print_status $BLUE "Testing critical application endpoints..."
    
    for endpoint in "${CRITICAL_ENDPOINTS[@]}"; do
        local url="$BASE_URL$endpoint"
        local result=$(http_request "$url" "GET" "200")
        local status_code=$(echo "$result" | cut -d'|' -f2)
        local duration=$(echo "$result" | cut -d'|' -f3)
        
        if [ -n "$status_code" ] && ([ "$status_code" = "200" ] || [ "$status_code" = "301" ] || [ "$status_code" = "302" ]); then
            log_test "Critical endpoint: $endpoint" "PASS" "Status: $status_code" "$duration"
        else
            log_test "Critical endpoint: $endpoint" "FAIL" "Status: ${status_code:-timeout}"
        fi
    done
}

# Function to test API endpoints
test_api_endpoints() {
    print_status $BLUE "Testing API endpoints..."
    
    # Test API endpoints that should be publicly accessible
    local api_endpoints=(
        "/api/health"
        "/api/metrics"
    )
    
    for endpoint in "${api_endpoints[@]}"; do
        local url="$BASE_URL$endpoint"
        local result=$(http_request "$url" "GET" "200")
        local status_code=$(echo "$result" | cut -d'|' -f2)
        local duration=$(echo "$result" | cut -d'|' -f3)
        
        if [ -n "$status_code" ] && [ "$status_code" = "200" ]; then
            log_test "API endpoint: $endpoint" "PASS" "Status: $status_code" "$duration"
        else
            log_test "API endpoint: $endpoint" "FAIL" "Status: ${status_code:-timeout}"
        fi
    done
    
    # Test protected endpoints (should return 401 or 403)
    local protected_endpoints=(
        "/api/admin/users"
        "/api/admin/analytics"
    )
    
    for endpoint in "${protected_endpoints[@]}"; do
        local url="$BASE_URL$endpoint"
        local result=$(http_request "$url" "GET" "401")
        local status_code=$(echo "$result" | cut -d'|' -f2)
        
        if [ -n "$status_code" ] && ([ "$status_code" = "401" ] || [ "$status_code" = "403" ]); then
            log_test "Protected endpoint: $endpoint" "PASS" "Properly protected (Status: $status_code)"
        else
            log_test "Protected endpoint: $endpoint" "FAIL" "Status: ${status_code:-timeout}"
        fi
    done
}

# Function to test SSL/TLS configuration
test_ssl_configuration() {
    if [[ "$BASE_URL" != https://* ]]; then
        log_test "SSL/TLS configuration" "SKIP" "Not using HTTPS"
        return
    fi
    
    print_status $BLUE "Testing SSL/TLS configuration..."
    
    local domain=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||')
    
    # Test SSL certificate validity
    local ssl_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [ -n "$ssl_info" ]; then
        log_test "SSL certificate validity" "PASS" "Certificate is valid"
        
        # Check certificate expiry
        local expiry_date=$(echo "$ssl_info" | grep "notAfter" | cut -d= -f2)
        local expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ "$days_until_expiry" -gt 7 ]; then
            log_test "SSL certificate expiry" "PASS" "Expires in $days_until_expiry days"
        else
            log_test "SSL certificate expiry" "FAIL" "Expires in $days_until_expiry days"
        fi
    else
        log_test "SSL certificate validity" "FAIL" "Could not retrieve certificate"
    fi
    
    # Test TLS version
    local tls_version=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | grep "Protocol" | awk '{print $3}')
    
    if [[ "$tls_version" == "TLSv1.2" ]] || [[ "$tls_version" == "TLSv1.3" ]]; then
        log_test "TLS version" "PASS" "Using $tls_version"
    else
        log_test "TLS version" "FAIL" "Using ${tls_version:-unknown}"
    fi
}

# Function to test security headers
test_security_headers() {
    print_status $BLUE "Testing security headers..."
    
    local headers_response=$(curl -I -s -m 10 "$BASE_URL" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Check for important security headers
        local security_headers=(
            "X-Frame-Options"
            "X-Content-Type-Options"
            "X-XSS-Protection"
            "Strict-Transport-Security"
            "Content-Security-Policy"
            "Referrer-Policy"
        )
        
        for header in "${security_headers[@]}"; do
            if echo "$headers_response" | grep -qi "$header"; then
                log_test "Security header: $header" "PASS" "Header present"
            else
                log_test "Security header: $header" "FAIL" "Header missing"
            fi
        done
    else
        log_test "Security headers check" "FAIL" "Could not retrieve headers"
    fi
}

# Function to test performance
test_performance() {
    print_status $BLUE "Testing performance..."
    
    # Test page load time
    local start_time=$(date +%s%3N)
    local result=$(http_request "$BASE_URL" "GET" "200")
    local duration=$(echo "$result" | cut -d'|' -f3)
    
    if [ -n "$duration" ]; then
        if [ "$duration" -lt 2000 ]; then
            log_test "Page load time" "PASS" "${duration}ms (< 2s)"
        elif [ "$duration" -lt 5000 ]; then
            log_test "Page load time" "FAIL" "${duration}ms (2-5s, should be < 2s)"
        else
            log_test "Page load time" "FAIL" "${duration}ms (> 5s, critical)"
        fi
    else
        log_test "Page load time" "FAIL" "Timeout"
    fi
    
    # Test health endpoint response time
    local health_result=$(http_request "$BASE_URL/api/health" "GET" "200")
    local health_duration=$(echo "$health_result" | cut -d'|' -f3)
    
    if [ -n "$health_duration" ]; then
        if [ "$health_duration" -lt 500 ]; then
            log_test "Health endpoint response time" "PASS" "${health_duration}ms (< 500ms)"
        else
            log_test "Health endpoint response time" "FAIL" "${health_duration}ms (> 500ms)"
        fi
    fi
}

# Function to test database connectivity
test_database_connectivity() {
    print_status $BLUE "Testing database connectivity..."
    
    # Test database health through health endpoint
    local health_result=$(http_request "$BASE_URL/api/health" "GET" "200")
    local health_body=$(echo "$health_result" | cut -d'|' -f1)
    
    if echo "$health_body" | grep -q '"database"'; then
        local db_status=$(echo "$health_body" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
        
        if [ "$db_status" = "healthy" ]; then
            log_test "Database connectivity" "PASS" "Database is healthy"
        else
            log_test "Database connectivity" "FAIL" "Database status: $db_status"
        fi
    else
        log_test "Database connectivity" "FAIL" "No database status in health response"
    fi
}

# Function to test external services
test_external_services() {
    if [ "$SKIP_EXTERNAL" = "true" ]; then
        log_test "External services" "SKIP" "Skipped by request"
        return
    fi
    
    print_status $BLUE "Testing external service connectivity..."
    
    # Test Stripe API connectivity
    local stripe_test=$(curl -s -m 10 "https://api.stripe.com/v1/account" -H "Authorization: Bearer ${STRIPE_SECRET_KEY:-dummy}" 2>/dev/null | grep -o '"object":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$stripe_test" = "account" ] || [ "$stripe_test" = "error" ]; then
        log_test "Stripe API connectivity" "PASS" "Stripe API is reachable"
    else
        log_test "Stripe API connectivity" "FAIL" "Cannot reach Stripe API"
    fi
    
    # Test DNS resolution
    local dns_test=$(nslookup stripe.com 8.8.8.8 2>/dev/null | grep -c "Address")
    
    if [ "$dns_test" -gt 0 ]; then
        log_test "DNS resolution" "PASS" "DNS is working"
    else
        log_test "DNS resolution" "FAIL" "DNS resolution failed"
    fi
}

# Function to test container health
test_container_health() {
    print_status $BLUE "Testing container health..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_test "Container health" "SKIP" "Docker not available"
        return
    fi
    
    # Check if containers are running
    local running_containers=$(docker ps --format "{{.Names}}" | grep -E "(app|postgres|redis|nginx)" | wc -l)
    
    if [ "$running_containers" -gt 0 ]; then
        log_test "Container status" "PASS" "$running_containers containers running"
    else
        log_test "Container status" "FAIL" "No application containers running"
    fi
    
    # Check container health status
    local unhealthy_containers=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
    
    if [ "$unhealthy_containers" -eq 0 ]; then
        log_test "Container health status" "PASS" "All containers healthy"
    else
        log_test "Container health status" "FAIL" "$unhealthy_containers unhealthy containers"
    fi
}

# Function to test file system health
test_filesystem_health() {
    print_status $BLUE "Testing file system health..."
    
    # Check disk space
    local disk_usage=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -lt 80 ]; then
        log_test "Disk space usage" "PASS" "${disk_usage}% used (< 80%)"
    elif [ "$disk_usage" -lt 90 ]; then
        log_test "Disk space usage" "FAIL" "${disk_usage}% used (80-90%, warning)"
    else
        log_test "Disk space usage" "FAIL" "${disk_usage}% used (> 90%, critical)"
    fi
    
    # Check if required directories exist
    local required_dirs=("uploads" "logs" "ssl")
    
    for dir in "${required_dirs[@]}"; do
        if [ -d "$PROJECT_ROOT/$dir" ]; then
            log_test "Directory exists: $dir" "PASS" "Directory present"
        else
            log_test "Directory exists: $dir" "FAIL" "Directory missing"
        fi
    done
}

# Function to generate summary report
generate_summary() {
    echo ""
    print_status $BLUE "=== Deployment Verification Summary ==="
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "Base URL: $BASE_URL"
    echo "Timestamp: $(date)"
    echo ""
    echo "Test Results:"
    echo "  Total Tests: $TOTAL_TESTS"
    echo "  Passed: $PASSED_TESTS"
    echo "  Failed: $FAILED_TESTS"
    echo "  Skipped: $SKIPPED_TESTS"
    echo ""
    
    local success_rate=0
    if [ "$TOTAL_TESTS" -gt 0 ]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    fi
    
    echo "Success Rate: $success_rate%"
    echo ""
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        print_status $GREEN "🎉 All tests passed! Deployment verification successful."
        return 0
    else
        print_status $RED "❌ $FAILED_TESTS test(s) failed. Please review and fix issues."
        return 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --url URL             Base URL to test (required)"
    echo "  --environment ENV     Environment name (default: production)"
    echo "  --timeout SECONDS     Request timeout (default: 30)"
    echo "  --verbose             Enable verbose output"
    echo "  --skip-external       Skip external service tests"
    echo "  --report FILE         Save detailed report to file"
    echo "  --help                Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BASE_URL              Base URL to test"
    echo "  ENVIRONMENT           Environment name"
    echo "  TIMEOUT               Request timeout in seconds"
    echo "  VERBOSE               Enable verbose output (true/false)"
    echo "  SKIP_EXTERNAL         Skip external tests (true/false)"
    echo "  STRIPE_SECRET_KEY     Stripe secret key for API tests"
    echo ""
    echo "Examples:"
    echo "  $0 --url https://yourapp.com"
    echo "  $0 --url https://staging.yourapp.com --environment staging"
    echo "  $0 --url https://yourapp.com --verbose --report /tmp/deployment-report.txt"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            BASE_URL=$2
            shift 2
            ;;
        --environment)
            ENVIRONMENT=$2
            shift 2
            ;;
        --timeout)
            TIMEOUT=$2
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --skip-external)
            SKIP_EXTERNAL=true
            shift
            ;;
        --report)
            REPORT_FILE=$2
            shift 2
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

# Validate required parameters
if [ -z "$BASE_URL" ]; then
    echo "Error: Base URL is required"
    echo "Use --url https://yourapp.com or set BASE_URL environment variable"
    exit 1
fi

# Remove trailing slash from BASE_URL
BASE_URL=${BASE_URL%/}

# Initialize report file if specified
if [ -n "$REPORT_FILE" ]; then
    mkdir -p "$(dirname "$REPORT_FILE")"
    echo "Deployment Verification Report - $(date)" > "$REPORT_FILE"
    echo "Environment: $ENVIRONMENT" >> "$REPORT_FILE"
    echo "Base URL: $BASE_URL" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# Main execution
main() {
    print_status $GREEN "🔍 Starting deployment verification for $ENVIRONMENT environment..."
    print_status $BLUE "Base URL: $BASE_URL"
    echo ""
    
    # Run all test suites
    test_basic_connectivity
    test_health_endpoints
    test_critical_endpoints
    test_api_endpoints
    test_ssl_configuration
    test_security_headers
    test_performance
    test_database_connectivity
    test_external_services
    test_container_health
    test_filesystem_health
    
    # Generate summary
    generate_summary
}

# Run the verification
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi