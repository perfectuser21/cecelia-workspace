#!/bin/bash

# ============================================
# Development Environment Startup Script
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo -e "${BLUE}"
echo "============================================"
echo "  Starting Development Environment"
echo "============================================"
echo -e "${NC}"

# Start database first
print_info "Starting PostgreSQL..."
cd "$PROJECT_ROOT/core/database"
docker-compose up -d

# Wait for database to be ready
print_info "Waiting for database to be ready..."
sleep 5

# Start backend in development mode
print_info "Starting Core API (development mode)..."
cd "$PROJECT_ROOT/backend"
npm run dev &
BACKEND_PID=$!

# Start frontend in development mode
print_info "Starting Frontend (development mode)..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

print_success "Development environment started!"
echo ""
print_info "Services running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Core API: http://localhost:3002"
echo "  - Frontend: http://localhost:5173 (Vite dev server)"
echo ""
print_warning "Press Ctrl+C to stop all services"

# Trap to cleanup on exit
trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; cd '$PROJECT_ROOT/core/database' && docker-compose down" EXIT

# Wait for processes
wait
