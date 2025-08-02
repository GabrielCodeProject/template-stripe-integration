#!/bin/bash

# Disaster Recovery and Restore Script for Stripe Payment Template
# Handles restoration from backups and disaster recovery procedures

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

# Command line arguments
RESTORE_TYPE=${1:-}
BACKUP_FILE=${2:-}
ENVIRONMENT=${ENVIRONMENT:-production}
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
FORCE_RESTORE=${FORCE_RESTORE:-false}
DRY_RUN=${DRY_RUN:-false}

# Load environment variables
if [ -f "${PROJECT_ROOT}/.env.${ENVIRONMENT}" ]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env.${ENVIRONMENT}" | xargs)
elif [ -f "${PROJECT_ROOT}/.env.local" ]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env.local" | xargs)
fi

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
    local log_file="${BACKUP_DIR}/restore.log"
    
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
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        case $status in
            error) color="danger" ;;
            warning) color="warning" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"$subject\",\"text\":\"$message\",\"footer\":\"Stripe Template Restore\",\"ts\":$(date +%s)}]}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log_message "INFO" "Checking restore prerequisites..."
    
    local missing_tools=()
    local tools=("docker" "docker-compose" "psql" "tar" "gzip")
    
    if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
        tools+=("gpg")
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
    
    log_message "SUCCESS" "Prerequisites check passed"
}

# Function to validate backup file
validate_backup_file() {
    local backup_file=$1
    
    log_message "INFO" "Validating backup file: $backup_file"
    
    if [ ! -f "$backup_file" ]; then
        log_message "ERROR" "Backup file not found: $backup_file"
        exit 1
    fi
    
    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [ "$file_size" -lt 1024 ]; then
        log_message "ERROR" "Backup file is too small: $file_size bytes"
        exit 1
    fi
    
    # Verify compression if applicable
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file" 2>/dev/null; then
            log_message "ERROR" "Compressed backup is corrupted"
            exit 1
        fi
    fi
    
    # Verify encryption if applicable
    if [[ "$backup_file" == *.gpg ]]; then
        if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
            log_message "ERROR" "Backup is encrypted but no decryption key provided"
            exit 1
        fi
        
        echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --quiet --decrypt --passphrase-fd 0 "$backup_file" >/dev/null 2>&1
        if [ $? -ne 0 ]; then
            log_message "ERROR" "Failed to decrypt backup file"
            exit 1
        fi
    fi
    
    log_message "SUCCESS" "Backup file validation passed"
}

# Function to create pre-restore backup
create_pre_restore_backup() {
    if [ "$FORCE_RESTORE" = "true" ]; then
        log_message "WARN" "Skipping pre-restore backup due to FORCE_RESTORE=true"
        return 0
    fi
    
    log_message "INFO" "Creating pre-restore backup..."
    
    local pre_restore_dir="${BACKUP_DIR}/pre-restore-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$pre_restore_dir"
    
    # Backup current database
    if docker ps | grep -q postgres; then
        docker exec postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${pre_restore_dir}/database.sql"
        gzip "${pre_restore_dir}/database.sql"
    fi
    
    # Backup current files
    if [ -d "${PROJECT_ROOT}/uploads" ]; then
        tar -czf "${pre_restore_dir}/files.tar.gz" -C "${PROJECT_ROOT}/uploads" . 2>/dev/null || true
    fi
    
    log_message "SUCCESS" "Pre-restore backup created: $pre_restore_dir"
    echo "$pre_restore_dir"
}

# Function to decrypt backup file
decrypt_backup() {
    local encrypted_file=$1
    local decrypted_file="${encrypted_file%.gpg}"
    
    if [[ "$encrypted_file" != *.gpg ]]; then
        echo "$encrypted_file"
        return 0
    fi
    
    log_message "INFO" "Decrypting backup file..."
    
    echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --quiet --decrypt --passphrase-fd 0 --output "$decrypted_file" "$encrypted_file"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Backup file decrypted successfully"
        echo "$decrypted_file"
    else
        log_message "ERROR" "Failed to decrypt backup file"
        exit 1
    fi
}

# Function to decompress backup file
decompress_backup() {
    local compressed_file=$1
    local decompressed_file="${compressed_file%.gz}"
    
    if [[ "$compressed_file" != *.gz ]]; then
        echo "$compressed_file"
        return 0
    fi
    
    log_message "INFO" "Decompressing backup file..."
    
    gunzip -c "$compressed_file" > "$decompressed_file"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Backup file decompressed successfully"
        echo "$decompressed_file"
    else
        log_message "ERROR" "Failed to decompress backup file"
        exit 1
    fi
}

# Function to restore database
restore_database() {
    local backup_file=$1
    
    log_message "INFO" "Starting database restore..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "DRY RUN: Would restore database from $backup_file"
        return 0
    fi
    
    # Process backup file (decrypt and decompress if needed)
    local processed_file="$backup_file"
    processed_file=$(decrypt_backup "$processed_file")
    processed_file=$(decompress_backup "$processed_file")
    
    # Ensure database container is running
    if ! docker ps | grep -q postgres; then
        log_message "INFO" "Starting PostgreSQL container..."
        docker-compose -f "${PROJECT_ROOT}/docker-compose.${ENVIRONMENT}.yml" up -d postgres
        sleep 10
    fi
    
    # Drop existing connections
    log_message "INFO" "Terminating existing database connections..."
    docker exec postgres psql -U "${POSTGRES_USER}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" 2>/dev/null || true
    
    # Drop and recreate database
    log_message "INFO" "Recreating database..."
    docker exec postgres psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" || true
    docker exec postgres psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"
    
    # Restore database
    log_message "INFO" "Restoring database data..."
    docker exec -i postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "$processed_file"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Database restored successfully"
        
        # Run post-restore database checks
        local table_count=$(docker exec postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
        log_message "INFO" "Restored database contains $table_count tables"
        
        # Clean up temporary files
        if [ "$processed_file" != "$backup_file" ]; then
            rm -f "$processed_file"
        fi
        
    else
        log_message "ERROR" "Database restore failed"
        exit 1
    fi
}

# Function to restore files
restore_files() {
    local backup_file=$1
    local target_dir="${PROJECT_ROOT}/uploads"
    
    log_message "INFO" "Starting files restore..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "DRY RUN: Would restore files from $backup_file to $target_dir"
        return 0
    fi
    
    # Process backup file (decrypt and decompress if needed)
    local processed_file="$backup_file"
    processed_file=$(decrypt_backup "$processed_file")
    processed_file=$(decompress_backup "$processed_file")
    
    # Backup existing files if they exist
    if [ -d "$target_dir" ] && [ "$(ls -A "$target_dir" 2>/dev/null)" ]; then
        local backup_existing="${target_dir}_backup_$(date +%Y%m%d_%H%M%S)"
        log_message "INFO" "Backing up existing files to $backup_existing"
        mv "$target_dir" "$backup_existing"
    fi
    
    # Create target directory
    mkdir -p "$target_dir"
    
    # Extract files
    log_message "INFO" "Extracting files to $target_dir"
    tar -xf "$processed_file" -C "$target_dir"
    
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "Files restored successfully"
        
        # Set proper permissions
        chown -R $(id -u):$(id -g) "$target_dir" 2>/dev/null || true
        chmod -R 755 "$target_dir"
        
        # Clean up temporary files
        if [ "$processed_file" != "$backup_file" ]; then
            rm -f "$processed_file"
        fi
        
    else
        log_message "ERROR" "Files restore failed"
        exit 1
    fi
}

# Function to restore configuration
restore_config() {
    local backup_file=$1
    
    log_message "INFO" "Starting configuration restore..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "DRY RUN: Would restore configuration from $backup_file"
        return 0
    fi
    
    # Process backup file (decrypt and decompress if needed)
    local processed_file="$backup_file"
    processed_file=$(decrypt_backup "$processed_file")
    processed_file=$(decompress_backup "$processed_file")
    
    # Create temporary extraction directory
    local temp_dir=$(mktemp -d)
    
    # Extract configuration
    log_message "INFO" "Extracting configuration files..."
    tar -xf "$processed_file" -C "$temp_dir"
    
    if [ $? -eq 0 ]; then
        # List of configuration items to restore
        local config_items=(
            "config/"
            "ssl/"
            "monitoring/"
        )
        
        # Restore each configuration item
        for item in "${config_items[@]}"; do
            if [ -e "${temp_dir}/$item" ]; then
                log_message "INFO" "Restoring $item"
                
                # Backup existing if it exists
                if [ -e "${PROJECT_ROOT}/$item" ]; then
                    local backup_path="${PROJECT_ROOT}/${item}_backup_$(date +%Y%m%d_%H%M%S)"
                    mv "${PROJECT_ROOT}/$item" "$backup_path"
                    log_message "INFO" "Existing $item backed up to $backup_path"
                fi
                
                # Restore configuration
                cp -r "${temp_dir}/$item" "${PROJECT_ROOT}/$item"
            fi
        done
        
        log_message "SUCCESS" "Configuration restored successfully"
        
        # Clean up
        rm -rf "$temp_dir"
        if [ "$processed_file" != "$backup_file" ]; then
            rm -f "$processed_file"
        fi
        
    else
        log_message "ERROR" "Configuration restore failed"
        rm -rf "$temp_dir"
        exit 1
    fi
}

# Function to list available backups
list_backups() {
    log_message "INFO" "Available backups in $BACKUP_DIR:"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_message "WARN" "Backup directory does not exist: $BACKUP_DIR"
        return 0
    fi
    
    # Find backup files
    local db_backups=($(find "$BACKUP_DIR" -name "db_backup_*.sql*" -o -name "*database*" | sort -r))
    local file_backups=($(find "$BACKUP_DIR" -name "files_backup_*.tar*" -o -name "*files*" | sort -r))
    local config_backups=($(find "$BACKUP_DIR" -name "config_backup_*.tar*" -o -name "*config*" | sort -r))
    local manifests=($(find "$BACKUP_DIR" -name "backup_manifest_*.json" | sort -r))
    
    echo ""
    echo "Database Backups:"
    for backup in "${db_backups[@]}"; do
        if [ -f "$backup" ]; then
            local size=$(du -h "$backup" | cut -f1)
            local date=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$backup" 2>/dev/null || stat -c%y "$backup" 2>/dev/null | cut -d. -f1)
            echo "  $(basename "$backup") - $size - $date"
        fi
    done
    
    echo ""
    echo "File Backups:"
    for backup in "${file_backups[@]}"; do
        if [ -f "$backup" ]; then
            local size=$(du -h "$backup" | cut -f1)
            local date=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$backup" 2>/dev/null || stat -c%y "$backup" 2>/dev/null | cut -d. -f1)
            echo "  $(basename "$backup") - $size - $date"
        fi
    done
    
    echo ""
    echo "Configuration Backups:"
    for backup in "${config_backups[@]}"; do
        if [ -f "$backup" ]; then
            local size=$(du -h "$backup" | cut -f1)
            local date=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$backup" 2>/dev/null || stat -c%y "$backup" 2>/dev/null | cut -d. -f1)
            echo "  $(basename "$backup") - $size - $date"
        fi
    done
    
    echo ""
    echo "Backup Manifests:"
    for manifest in "${manifests[@]}"; do
        if [ -f "$manifest" ]; then
            local date=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$manifest" 2>/dev/null || stat -c%y "$manifest" 2>/dev/null | cut -d. -f1)
            echo "  $(basename "$manifest") - $date"
        fi
    done
}

# Function to verify system after restore
verify_system() {
    log_message "INFO" "Verifying system after restore..."
    
    # Check if containers are running
    local containers=("postgres" "redis" "app")
    for container in "${containers[@]}"; do
        if docker ps | grep -q "$container"; then
            log_message "SUCCESS" "Container $container is running"
        else
            log_message "WARN" "Container $container is not running"
        fi
    done
    
    # Check database connection
    if docker exec postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT 1;" >/dev/null 2>&1; then
        log_message "SUCCESS" "Database connection successful"
    else
        log_message "ERROR" "Database connection failed"
    fi
    
    # Check application health
    sleep 10  # Wait for application to start
    if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        log_message "SUCCESS" "Application health check passed"
    else
        log_message "WARN" "Application health check failed (may need more time to start)"
    fi
    
    log_message "INFO" "System verification completed"
}

# Function to show help
show_help() {
    echo "Usage: $0 <restore_type> [backup_file]"
    echo ""
    echo "Restore types:"
    echo "  database <file>  - Restore database from backup file"
    echo "  files <file>     - Restore uploaded files from backup file"
    echo "  config <file>    - Restore configuration from backup file"
    echo "  full <file>      - Full system restore (requires manual file selection)"
    echo "  list             - List available backups"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT          - Target environment (development/staging/production)"
    echo "  BACKUP_DIR          - Backup directory path"
    echo "  FORCE_RESTORE       - Skip confirmation prompts (true/false)"
    echo "  DRY_RUN             - Show what would be restored without doing it (true/false)"
    echo "  BACKUP_ENCRYPTION_KEY - Key for decrypting encrypted backups"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 database /path/to/db_backup_20231201_120000.sql.gz"
    echo "  $0 files /path/to/files_backup_20231201_120000.tar.gz"
    echo "  DRY_RUN=true $0 database backup.sql.gz  # Test restore"
    echo "  FORCE_RESTORE=true $0 full backup.sql   # Skip prompts"
}

# Function to confirm restore operation
confirm_restore() {
    if [ "$FORCE_RESTORE" = "true" ]; then
        return 0
    fi
    
    echo ""
    print_status $YELLOW "⚠️  WARNING: This will restore data and may overwrite existing data!"
    print_status $YELLOW "Environment: $ENVIRONMENT"
    print_status $YELLOW "Restore type: $RESTORE_TYPE"
    print_status $YELLOW "Backup file: $BACKUP_FILE"
    echo ""
    
    read -p "Are you sure you want to proceed? Type 'yes' to continue: " -r
    if [[ ! $REPLY == "yes" ]]; then
        log_message "INFO" "Restore operation cancelled by user"
        exit 0
    fi
}

# Main execution function
main() {
    case $RESTORE_TYPE in
        database|db)
            if [ -z "$BACKUP_FILE" ]; then
                log_message "ERROR" "Backup file required for database restore"
                show_help
                exit 1
            fi
            
            check_prerequisites
            validate_backup_file "$BACKUP_FILE"
            confirm_restore
            
            local pre_restore_backup=$(create_pre_restore_backup)
            
            restore_database "$BACKUP_FILE"
            
            if [ "$DRY_RUN" != "true" ]; then
                verify_system
                send_notification "Database Restore Completed" "Database restore completed successfully for $ENVIRONMENT environment" "success"
            fi
            ;;
            
        files)
            if [ -z "$BACKUP_FILE" ]; then
                log_message "ERROR" "Backup file required for files restore"
                show_help
                exit 1
            fi
            
            check_prerequisites
            validate_backup_file "$BACKUP_FILE"
            confirm_restore
            
            restore_files "$BACKUP_FILE"
            
            if [ "$DRY_RUN" != "true" ]; then
                send_notification "Files Restore Completed" "Files restore completed successfully for $ENVIRONMENT environment" "success"
            fi
            ;;
            
        config)
            if [ -z "$BACKUP_FILE" ]; then
                log_message "ERROR" "Backup file required for configuration restore"
                show_help
                exit 1
            fi
            
            check_prerequisites
            validate_backup_file "$BACKUP_FILE"
            confirm_restore
            
            restore_config "$BACKUP_FILE"
            
            if [ "$DRY_RUN" != "true" ]; then
                send_notification "Configuration Restore Completed" "Configuration restore completed successfully for $ENVIRONMENT environment" "success"
            fi
            ;;
            
        full)
            log_message "ERROR" "Full restore requires manual selection of individual backup files"
            log_message "INFO" "Please run separate restore commands for database, files, and config"
            list_backups
            exit 1
            ;;
            
        list)
            list_backups
            ;;
            
        -h|--help|help|"")
            show_help
            exit 0
            ;;
            
        *)
            log_message "ERROR" "Unknown restore type: $RESTORE_TYPE"
            show_help
            exit 1
            ;;
    esac
}

# Handle script execution
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi