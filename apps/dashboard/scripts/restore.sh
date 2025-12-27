#!/bin/bash

# ============================================
# Restore Script for Database and Configuration
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/social-metrics}"
DB_CONTAINER="${DB_CONTAINER:-social-metrics-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-social_metrics}"

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# ==========================================
# Select Backup
# ==========================================
print_info "Available backups in $BACKUP_DIR:"
echo ""

backups=($(find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f | sort -r))

if [ ${#backups[@]} -eq 0 ]; then
    print_error "No backups found in $BACKUP_DIR"
    exit 1
fi

# List backups
for i in "${!backups[@]}"; do
    backup_file=$(basename "${backups[$i]}")
    backup_date=$(echo "$backup_file" | sed 's/backup_\([0-9]\{8\}_[0-9]\{6\}\).*/\1/')
    backup_size=$(du -h "${backups[$i]}" | cut -f1)
    echo "  [$i] $backup_file ($backup_size) - $backup_date"
done

echo ""
read -p "Select backup number to restore (or 'q' to quit): " selection

if [ "$selection" == "q" ]; then
    print_info "Restore cancelled"
    exit 0
fi

if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -ge ${#backups[@]} ]; then
    print_error "Invalid selection"
    exit 1
fi

BACKUP_FILE="${backups[$selection]}"
BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)

print_info "Selected backup: $BACKUP_FILE"

# ==========================================
# Confirmation
# ==========================================
print_warning "WARNING: This will replace current data!"
read -p "Are you sure you want to restore? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_info "Restore cancelled"
    exit 0
fi

# ==========================================
# Extract Backup
# ==========================================
print_info "Extracting backup..."
TEMP_DIR=$(mktemp -d)
tar xzf "$BACKUP_FILE" -C "$TEMP_DIR"
EXTRACT_PATH="$TEMP_DIR/$BACKUP_NAME"

print_success "Backup extracted to $EXTRACT_PATH"

# ==========================================
# Restore Database
# ==========================================
if [ -f "$EXTRACT_PATH/database.sql" ]; then
    print_info "Restoring PostgreSQL database..."

    # Check if container is running
    if ! docker ps | grep -q "$DB_CONTAINER"; then
        print_error "Database container is not running. Please start it first."
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    # Drop and recreate database
    print_warning "Dropping existing database..."
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

    # Restore globals
    if [ -f "$EXTRACT_PATH/globals.sql" ]; then
        docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" < "$EXTRACT_PATH/globals.sql"
    fi

    # Restore database
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME" < "$EXTRACT_PATH/database.sql"

    print_success "Database restored successfully"
else
    print_warning "No database backup found in archive"
fi

# ==========================================
# Restore n8n Data
# ==========================================
if [ -f "$EXTRACT_PATH/n8n_data.tar.gz" ]; then
    print_info "Restoring n8n data..."

    if docker ps | grep -q "social-metrics-n8n"; then
        # Stop n8n container
        print_info "Stopping n8n container..."
        docker stop social-metrics-n8n

        # Restore data
        docker run --rm \
            --volumes-from social-metrics-n8n \
            -v "$EXTRACT_PATH:/backup" \
            alpine \
            sh -c "cd / && tar xzf /backup/n8n_data.tar.gz"

        # Start n8n container
        print_info "Starting n8n container..."
        docker start social-metrics-n8n

        print_success "n8n data restored successfully"
    else
        print_warning "n8n container not found, skipping n8n data restore"
    fi
fi

# ==========================================
# Restore Configuration Files
# ==========================================
print_warning "Configuration files found in backup."
print_warning "These need to be restored manually to avoid overwriting current settings."
print_info "Configuration files are located in: $EXTRACT_PATH"
echo ""
read -p "Do you want to see the list of configuration files? (yes/no): " show_files

if [ "$show_files" == "yes" ]; then
    find "$EXTRACT_PATH" -name ".env" -o -name "docker-compose.yml" | while read file; do
        echo "  - ${file#$EXTRACT_PATH/}"
    done
    echo ""
    print_info "You can manually copy these files if needed"
fi

# ==========================================
# Cleanup
# ==========================================
print_info "Keeping extracted files at: $TEMP_DIR"
print_info "You can delete them manually after verification"

# ==========================================
# Summary
# ==========================================
echo ""
print_success "Restore completed successfully!"
echo ""
echo "Restore Summary:"
echo "  Backup: $BACKUP_FILE"
echo "  Database: Restored"
if [ -f "$EXTRACT_PATH/n8n_data.tar.gz" ] && docker ps | grep -q "social-metrics-n8n"; then
    echo "  n8n Data: Restored"
fi
echo "  Configuration: Available at $TEMP_DIR"
echo ""
print_warning "Please verify that all services are working correctly"
