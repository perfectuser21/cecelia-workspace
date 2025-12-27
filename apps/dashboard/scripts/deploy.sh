#!/bin/bash

# ============================================
# Social Media Metrics - One-Click Deployment
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/infrastructure/docker"

# Default values
PROFILE="minimal"
ACTION="up"
BUILD_FLAG=""
DETACH_FLAG="-d"

# ==========================================
# Helper Functions
# ==========================================
print_banner() {
    echo -e "${BLUE}"
    echo "============================================"
    echo "  Social Media Metrics - Deployment Script"
    echo "============================================"
    echo -e "${NC}"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Social Media Metrics platform with Docker Compose.

OPTIONS:
    --profile=PROFILE    Deployment profile (minimal|n8n|coze|all|production)
                        Default: minimal
    --build             Force rebuild of Docker images
    --no-detach         Run in foreground (don't use -d flag)
    --down              Stop and remove containers
    --restart           Restart all services
    --logs              Show logs
    --status            Show service status
    --help              Display this help message

PROFILES:
    minimal       PostgreSQL + Core API + Frontend (default)
    n8n           Minimal + n8n automation
    coze          Minimal + Coze integration
    production    Full stack with Nginx gateway
    all           All services enabled

EXAMPLES:
    $0                              # Minimal deployment
    $0 --profile=n8n --build       # Deploy with n8n, rebuild images
    $0 --profile=all               # Full deployment
    $0 --down                      # Stop all services
    $0 --logs                      # View logs
    $0 --status                    # Check service status

EOF
}

check_dependencies() {
    print_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_success "All dependencies are installed"
}

check_env_file() {
    if [ ! -f "$DOCKER_DIR/.env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        if [ -f "$DOCKER_DIR/.env.example" ]; then
            cp "$DOCKER_DIR/.env.example" "$DOCKER_DIR/.env"
            print_warning "Please edit $DOCKER_DIR/.env with your configuration"
            print_warning "Press Enter to continue or Ctrl+C to abort..."
            read
        else
            print_error ".env.example not found. Cannot create .env file."
            exit 1
        fi
    fi
}

create_network() {
    print_info "Creating Docker network if not exists..."
    docker network inspect social-metrics-network >/dev/null 2>&1 || \
        docker network create social-metrics-network --subnet=172.28.0.0/16
    print_success "Network ready"
}

deploy_services() {
    print_info "Deploying services with profile: $PROFILE"

    cd "$DOCKER_DIR"

    local compose_cmd="docker-compose"
    if ! command -v docker-compose &> /dev/null; then
        compose_cmd="docker compose"
    fi

    local profile_flag=""
    if [ "$PROFILE" != "minimal" ]; then
        profile_flag="--profile $PROFILE"
    fi

    print_info "Running: $compose_cmd $profile_flag up $BUILD_FLAG $DETACH_FLAG"
    $compose_cmd $profile_flag up $BUILD_FLAG $DETACH_FLAG

    if [ "$DETACH_FLAG" == "-d" ]; then
        print_success "Services started successfully"
        sleep 3
        show_status
    fi
}

stop_services() {
    print_info "Stopping all services..."
    cd "$DOCKER_DIR"

    local compose_cmd="docker-compose"
    if ! command -v docker-compose &> /dev/null; then
        compose_cmd="docker compose"
    fi

    $compose_cmd --profile all down
    print_success "All services stopped"
}

restart_services() {
    print_info "Restarting services..."
    stop_services
    sleep 2
    deploy_services
}

show_logs() {
    cd "$DOCKER_DIR"

    local compose_cmd="docker-compose"
    if ! command -v docker-compose &> /dev/null; then
        compose_cmd="docker compose"
    fi

    $compose_cmd --profile all logs -f --tail=100
}

show_status() {
    print_info "Service Status:"
    echo ""
    docker ps --filter "name=social-metrics-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    print_info "Health Checks:"
    for container in $(docker ps --filter "name=social-metrics-" --format "{{.Names}}"); do
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no healthcheck")
        if [ "$health" == "healthy" ]; then
            echo -e "${GREEN}✓${NC} $container: $health"
        elif [ "$health" == "no healthcheck" ]; then
            echo -e "${YELLOW}○${NC} $container: $health"
        else
            echo -e "${RED}✗${NC} $container: $health"
        fi
    done
    echo ""

    print_info "Access URLs:"
    echo "  Frontend:  http://localhost:3000"
    echo "  Core API:  http://localhost:3002"
    echo "  n8n:       http://localhost:5678"
}

# ==========================================
# Parse Arguments
# ==========================================
for arg in "$@"; do
    case $arg in
        --profile=*)
            PROFILE="${arg#*=}"
            ;;
        --build)
            BUILD_FLAG="--build"
            ;;
        --no-detach)
            DETACH_FLAG=""
            ;;
        --down)
            ACTION="down"
            ;;
        --restart)
            ACTION="restart"
            ;;
        --logs)
            ACTION="logs"
            ;;
        --status)
            ACTION="status"
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $arg"
            show_help
            exit 1
            ;;
    esac
done

# ==========================================
# Main Execution
# ==========================================
print_banner

case $ACTION in
    up)
        check_dependencies
        check_env_file
        create_network
        deploy_services
        ;;
    down)
        stop_services
        ;;
    restart)
        check_dependencies
        check_env_file
        create_network
        restart_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
esac

print_success "Operation completed!"
