#!/bin/bash

# Automated Backup Script for Stripe Payment Template
# Handles database backups, file uploads, and disaster recovery

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
BACKUP_TYPE=${1:-full}
ENVIRONMENT=${ENVIRONMENT:-production}
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
RETENTION_DAYS=${RETENTION_DAYS:-30}
S3_ENABLED=${S3_ENABLED:-false}
S3_BUCKET=${S3_BUCKET:-}
ENCRYPTION_ENABLED=${ENCRYPTION_ENABLED:-true}
COMPRESSION_ENABLED=${COMPRESSION_ENABLED:-true}
NOTIFICATION_ENABLED=${NOTIFICATION_ENABLED:-true}

# Load environment variables
if [ -f "${PROJECT_ROOT}/.env.${ENVIRONMENT}" ]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env.${ENVIRONMENT}" | xargs)
elif [ -f "${PROJECT_ROOT}/.env.local" ]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env.local" | xargs)
fi

# Backup configuration based on environment
case $ENVIRONMENT in
    production)
        BACKUP_SCHEDULE="hourly"
        RETENTION_DAYS=90
        ENCRYPTION_ENABLED=true
        S3_ENABLED=true
        ;;
    staging)
        BACKUP_SCHEDULE="daily"
        RETENTION_DAYS=30
        ENCRYPTION_ENABLED=true
        S3_ENABLED=false
        ;;
    development)
        BACKUP_SCHEDULE="manual"
        RETENTION_DAYS=7
        ENCRYPTION_ENABLED=false
        S3_ENABLED=false
        ;;
esac

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
    local log_file="${BACKUP_DIR}/backup.log"
    
    mkdir -p "$(dirname "$log_file")"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$log_file"
    
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

# Function to send notifications
send_notification() {
    local subject=$1
    local message=$2
    local status=${3:-info}
    
    if [ "$NOTIFICATION_ENABLED" != "true" ]; then
        return 0
    fi
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        case $status in
            error) color="danger" ;;
            warning) color="warning" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"$subject\",\"text\":\"$message\",\"footer\":\"Stripe Template Backup\",\"ts\":$(date +%s)}]}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Discord notification
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        local embed_color=65280  # green
        case $status in
            error) embed_color=16711680 ;;  # red
            warning) embed_color=16776960 ;; # yellow
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"embeds\":[{\"title\":\"$subject\",\"description\":\"$message\",\"color\":$embed_color,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}]}" \
            "$DISCORD_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log_message "INFO" "Checking backup prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    local tools=("docker" "pg_dump" "tar" "gzip")
    
    if [ "$ENCRYPTION_ENABLED" = "true" ]; then
        tools+=("gpg")
    fi
    
    if [ "$S3_ENABLED" = "true" ]; then
        tools+=("aws")
    fi
    
    for tool in "${tools[@]}"; do
        if ! command -v $tool >/dev/null 2>&1; then
            missing_tools+=($tool)
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_message "ERROR" "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check if containers are running
    if [ "$ENVIRONMENT" != "development" ]; then
        if ! docker ps | grep -q postgres; then
            log_message "ERROR" "PostgreSQL container is not running"
            exit 1
        fi
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    chmod 750 "$BACKUP_DIR"
    
    log_message "SUCCESS" "Prerequisites check passed"
}

# Function to backup database
backup_database() {
    log_message "INFO" "Starting database backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="db_backup_${timestamp}"
    local backup_file="${BACKUP_DIR}/${backup_name}.sql"
    
    # Create database backup
    if docker ps | grep -q postgres; then
        # Use Docker exec for containerized database
        docker exec postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "$backup_file"
    else
        # Direct connection for external database
        PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "$backup_file"
    fi
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Database backup created: $backup_file"
        
        # Get backup size
        local backup_size=$(du -h "$backup_file" | cut -f1)
        log_message "INFO" "Backup size: $backup_size"
        
        # Compress if enabled
        if [ "$COMPRESSION_ENABLED" = "true" ]; then
            gzip "$backup_file"
            backup_file="${backup_file}.gz"
            local compressed_size=$(du -h "$backup_file" | cut -f1)
            log_message "INFO" "Compressed size: $compressed_size"
        fi
        
        # Encrypt if enabled
        if [ "$ENCRYPTION_ENABLED" = "true" ]; then
            encrypt_file "$backup_file"
        fi
        
        # Upload to S3 if enabled
        if [ "$S3_ENABLED" = "true" ]; then
            upload_to_s3 "$backup_file" "database/"
        fi
        
        echo "$backup_file"
    else
        log_message "ERROR" "Database backup failed"
        exit 1
    fi
}

# Function to backup uploaded files
backup_files() {
    log_message "INFO" "Starting file uploads backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="files_backup_${timestamp}"
    local backup_file="${BACKUP_DIR}/${backup_name}.tar"
    local uploads_dir="${PROJECT_ROOT}/uploads"
    
    if [ ! -d "$uploads_dir" ] || [ -z "$(ls -A "$uploads_dir" 2>/dev/null)" ]; then
        log_message "WARN" "No files to backup in uploads directory"
        return 0
    fi
    
    # Create tar archive
    tar -cf "$backup_file" -C "$uploads_dir" .
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Files backup created: $backup_file"
        
        # Compress if enabled
        if [ "$COMPRESSION_ENABLED" = "true" ]; then
            gzip "$backup_file"
            backup_file="${backup_file}.gz"
        fi
        
        # Encrypt if enabled
        if [ "$ENCRYPTION_ENABLED" = "true" ]; then
            encrypt_file "$backup_file"
        fi
        
        # Upload to S3 if enabled
        if [ "$S3_ENABLED" = "true" ]; then
            upload_to_s3 "$backup_file" "files/"
        fi
        
        echo "$backup_file"
    else
        log_message "ERROR" "Files backup failed"
        exit 1
    fi
}

# Function to backup application configuration
backup_config() {
    log_message "INFO" "Starting configuration backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="config_backup_${timestamp}"
    local backup_file="${BACKUP_DIR}/${backup_name}.tar"
    
    # Files and directories to backup
    local config_items=(
        "docker-compose.yml"
        "docker-compose.prod.yml"
        "docker-compose.staging.yml"
        "config/"
        "ssl/"
        ".env.example"
        "scripts/"
        "monitoring/"
    )
    
    # Create tar archive with existing items only
    local existing_items=()
    for item in "${config_items[@]}"; do
        if [ -e "${PROJECT_ROOT}/$item" ]; then
            existing_items+=("$item")
        fi
    done
    
    if [ ${#existing_items[@]} -eq 0 ]; then
        log_message "WARN" "No configuration files to backup"
        return 0
    fi
    
    tar -cf "$backup_file" -C "$PROJECT_ROOT" "${existing_items[@]}"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Configuration backup created: $backup_file"
        
        # Compress if enabled
        if [ "$COMPRESSION_ENABLED" = "true" ]; then
            gzip "$backup_file"
            backup_file="${backup_file}.gz"
        fi
        
        # Encrypt if enabled
        if [ "$ENCRYPTION_ENABLED" = "true" ]; then
            encrypt_file "$backup_file"
        fi
        
        # Upload to S3 if enabled
        if [ "$S3_ENABLED" = "true" ]; then
            upload_to_s3 "$backup_file" "config/"
        fi
        
        echo "$backup_file"
    else
        log_message "ERROR" "Configuration backup failed"
        exit 1
    fi
}

# Function to encrypt file
encrypt_file() {
    local file=$1
    
    if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        log_message "WARN" "No encryption key provided, skipping encryption"
        return 0
    fi
    
    log_message "INFO" "Encrypting backup file..."
    
    echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --cipher-algo AES256 --compress-algo 1 --symmetric --passphrase-fd 0 --output "${file}.gpg" "$file"
    
    if [ $? -eq 0 ]; then
        rm "$file"
        log_message "SUCCESS" "File encrypted: ${file}.gpg"
    else
        log_message "ERROR" "File encryption failed"
        exit 1
    fi
}

# Function to upload to S3
upload_to_s3() {
    local file=$1
    local s3_prefix=${2:-}
    
    if [ -z "$S3_BUCKET" ]; then
        log_message "WARN" "S3 bucket not configured, skipping upload"
        return 0
    fi
    
    log_message "INFO" "Uploading to S3: s3://${S3_BUCKET}/${s3_prefix}$(basename "$file")"
    
    aws s3 cp "$file" "s3://${S3_BUCKET}/${s3_prefix}$(basename "$file")" \
        --storage-class STANDARD_IA \
        --metadata "environment=${ENVIRONMENT},backup-type=${BACKUP_TYPE},timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "File uploaded to S3 successfully"
    else
        log_message "ERROR" "S3 upload failed"
        return 1
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    log_message "INFO" "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "*.sql*" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar*" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.gpg" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # S3 cleanup if enabled
    if [ "$S3_ENABLED" = "true" ] && [ -n "$S3_BUCKET" ]; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        aws s3api list-objects-v2 --bucket "$S3_BUCKET" --query "Contents[?LastModified<='$cutoff_date'].Key" --output text | \
        while read -r key; do
            if [ -n "$key" ] && [ "$key" != "None" ]; then
                aws s3 rm "s3://$S3_BUCKET/$key"
                log_message "INFO" "Deleted old S3 backup: $key"
            fi
        done
    fi
    
    log_message "SUCCESS" "Cleanup completed"
}

# Function to verify backup integrity
verify_backup() {
    local backup_file=$1
    
    log_message "INFO" "Verifying backup integrity..."
    
    if [ ! -f "$backup_file" ]; then
        log_message "ERROR" "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [ "$file_size" -lt 1024 ]; then
        log_message "ERROR" "Backup file is too small: $file_size bytes"
        return 1
    fi
    
    # Verify compression if applicable
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file" 2>/dev/null; then
            log_message "ERROR" "Compressed backup is corrupted"
            return 1
        fi
    fi
    
    # Verify encryption if applicable
    if [[ "$backup_file" == *.gpg ]]; then
        if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
            echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --quiet --decrypt --passphrase-fd 0 "$backup_file" >/dev/null 2>&1
            if [ $? -ne 0 ]; then
                log_message "ERROR" "Encrypted backup verification failed"
                return 1
            fi
        fi
    fi
    
    log_message "SUCCESS" "Backup integrity verified"
    return 0
}

# Function to create backup manifest
create_manifest() {
    local backup_files=("$@")
    local manifest_file="${BACKUP_DIR}/backup_manifest_$(date +%Y%m%d_%H%M%S).json"
    
    log_message "INFO" "Creating backup manifest..."
    
    cat > "$manifest_file" << EOF
{
  "backup_info": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "backup_type": "$BACKUP_TYPE",
    "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "retention_days": $RETENTION_DAYS
  },
  "backup_files": [
EOF
    
    for i in "${!backup_files[@]}"; do
        local file="${backup_files[$i]}"
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        local checksum=$(sha256sum "$file" | cut -d' ' -f1)
        
        cat >> "$manifest_file" << EOF
    {
      "filename": "$(basename "$file")",
      "path": "$file",
      "size": $size,
      "checksum": "$checksum",
      "type": "$(echo "$(basename "$file")" | sed 's/.*_backup_[0-9_]*\.\(.*\)/\1/' | sed 's/\..*$//')"
    }$([ $i -lt $((${#backup_files[@]} - 1)) ] && echo "," || echo "")
EOF
    done
    
    cat >> "$manifest_file" << EOF
  ]
}
EOF
    
    log_message "SUCCESS" "Backup manifest created: $manifest_file"
    echo "$manifest_file"
}

# Function to perform full backup
full_backup() {
    log_message "INFO" "Starting full backup process..."
    
    local start_time=$(date +%s)
    local backup_files=()
    
    # Database backup
    local db_backup=$(backup_database)
    if [ -n "$db_backup" ]; then
        backup_files+=("$db_backup")
    fi
    
    # Files backup
    local files_backup=$(backup_files)
    if [ -n "$files_backup" ]; then
        backup_files+=("$files_backup")
    fi
    
    # Configuration backup
    local config_backup=$(backup_config)
    if [ -n "$config_backup" ]; then
        backup_files+=("$config_backup")
    fi
    
    # Create manifest
    if [ ${#backup_files[@]} -gt 0 ]; then
        local manifest=$(create_manifest "${backup_files[@]}")
        backup_files+=("$manifest")
    fi
    
    # Verify all backups
    local verification_failed=false
    for backup_file in "${backup_files[@]}"; do
        if ! verify_backup "$backup_file"; then
            verification_failed=true
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$verification_failed" = "true" ]; then
        log_message "ERROR" "Backup verification failed"
        send_notification "Backup Failed" "One or more backup verifications failed for $ENVIRONMENT environment" "error"
        exit 1
    else
        log_message "SUCCESS" "Full backup completed successfully in ${duration}s"
        send_notification "Backup Completed" "Full backup completed successfully for $ENVIRONMENT environment in ${duration}s" "success"
    fi
    
    # Cleanup old backups
    cleanup_old_backups
}

# Function to perform database-only backup
database_backup() {
    log_message "INFO" "Starting database-only backup..."
    
    local db_backup=$(backup_database)
    
    if verify_backup "$db_backup"; then
        log_message "SUCCESS" "Database backup completed successfully"
        send_notification "Database Backup Completed" "Database backup completed for $ENVIRONMENT environment" "success"
    else
        log_message "ERROR" "Database backup verification failed"
        send_notification "Database Backup Failed" "Database backup verification failed for $ENVIRONMENT environment" "error"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [backup_type]"
    echo ""
    echo "Backup types:"
    echo "  full      - Complete backup (database + files + config) [default]"
    echo "  database  - Database only backup"
    echo "  files     - Files only backup"
    echo "  config    - Configuration only backup"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT          - Target environment (development/staging/production)"
    echo "  BACKUP_DIR          - Backup directory path"
    echo "  RETENTION_DAYS      - Number of days to keep backups"
    echo "  S3_ENABLED          - Enable S3 uploads (true/false)"
    echo "  S3_BUCKET           - S3 bucket name"
    echo "  ENCRYPTION_ENABLED  - Enable backup encryption (true/false)"
    echo "  COMPRESSION_ENABLED - Enable backup compression (true/false)"
    echo "  NOTIFICATION_ENABLED - Enable notifications (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Full backup"
    echo "  $0 database          # Database only"
    echo "  ENVIRONMENT=staging $0 full  # Staging full backup"
}

# Main execution
main() {
    case $BACKUP_TYPE in
        full)
            check_prerequisites
            full_backup
            ;;
        database|db)
            check_prerequisites
            database_backup
            ;;
        files)
            check_prerequisites
            backup_files
            ;;
        config)
            check_prerequisites
            backup_config
            ;;
        -h|--help|help)
            show_help
            exit 0
            ;;
        *)
            log_message "ERROR" "Unknown backup type: $BACKUP_TYPE"
            show_help
            exit 1
            ;;
    esac
}

# Handle script execution
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi