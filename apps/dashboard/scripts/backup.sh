#!/bin/bash

# ============================================
# Backup Script for Database and Configuration
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/social-metrics}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}"

# Database settings (from .env or defaults)
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

# Create backup directory
mkdir -p "$BACKUP_DIR"

print_info "Starting backup process..."
print_info "Backup directory: $BACKUP_DIR"

# Create backup subdirectory
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_PATH"

# ==========================================
# Backup PostgreSQL Database
# ==========================================
print_info "Backing up PostgreSQL database..."

if docker ps | grep -q "$DB_CONTAINER"; then
    docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_PATH/database.sql"
    docker exec "$DB_CONTAINER" pg_dumpall -U "$DB_USER" --globals-only > "$BACKUP_PATH/globals.sql"
    print_success "Database backup completed"
else
    print_error "Database container is not running"
    exit 1
fi

# ==========================================
# Backup n8n Data (if exists)
# ==========================================
if docker ps | grep -q "social-metrics-n8n"; then
    print_info "Backing up n8n data..."
    docker run --rm \
        --volumes-from social-metrics-n8n \
        -v "$BACKUP_PATH:/backup" \
        alpine \
        tar czf /backup/n8n_data.tar.gz /home/node/.n8n
    print_success "n8n data backup completed"
fi

# ==========================================
# Backup Configuration Files
# ==========================================
print_info "Backing up configuration files..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Backup .env files
find "$PROJECT_ROOT" -name ".env" -not -path "*/node_modules/*" -exec cp --parents {} "$BACKUP_PATH/" \;

# Backup docker-compose files
find "$PROJECT_ROOT" -name "docker-compose.yml" -exec cp --parents {} "$BACKUP_PATH/" \;

print_success "Configuration backup completed"

# ==========================================
# Compress Backup
# ==========================================
print_info "Compressing backup..."
cd "$BACKUP_DIR"
tar czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
print_success "Backup compressed: ${BACKUP_NAME}.tar.gz ($BACKUP_SIZE)"

# ==========================================
# Cleanup Old Backups
# ==========================================
print_info "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
print_success "Cleanup completed"

# ==========================================
# Backup Summary
# ==========================================
echo ""
print_success "Backup completed successfully!"
echo ""
echo "Backup Details:"
echo "  Location: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo "  Size: $BACKUP_SIZE"
echo "  Timestamp: $TIMESTAMP"
echo ""
echo "Contents:"
echo "  - PostgreSQL database dump"
echo "  - Global database settings"
if docker ps | grep -q "social-metrics-n8n"; then
    echo "  - n8n workflow data"
fi
echo "  - Configuration files (.env, docker-compose.yml)"
