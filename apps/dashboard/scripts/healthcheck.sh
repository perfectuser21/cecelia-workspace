#!/bin/bash

# ============================================
# Health Check Script for All Services
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
ALERT_ON_FAILURE="${ALERT_ON_FAILURE:-false}"

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Health Check Report - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_container() {
    local container_name=$1
    local service_name=$2

    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        local status=$(docker inspect --format='{{.State.Status}}' "$container_name")
        local health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_name")

        echo -n "  $service_name: "

        if [ "$status" == "running" ]; then
            if [ "$health" == "healthy" ]; then
                echo -e "${GREEN}✓ Running (Healthy)${NC}"
                return 0
            elif [ "$health" == "no-healthcheck" ]; then
                echo -e "${YELLOW}○ Running (No healthcheck)${NC}"
                return 0
            else
                echo -e "${RED}✗ Running (Unhealthy: $health)${NC}"
                return 1
            fi
        else
            echo -e "${RED}✗ Not running (Status: $status)${NC}"
            return 1
        fi
    else
        echo -e "  $service_name: ${YELLOW}○ Not deployed${NC}"
        return 0  # Not an error if service is not deployed
    fi
}

check_endpoint() {
    local url=$1
    local service_name=$2
    local expected_code=${3:-200}

    echo -n "  $service_name: "

    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")

    if [ "$response" == "$expected_code" ]; then
        echo -e "${GREEN}✓ Responding ($response)${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed (HTTP $response)${NC}"
        return 1
    fi
}

check_database() {
    echo -n "  PostgreSQL: "

    if docker exec social-metrics-postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        return 0
    else
        echo -e "${RED}✗ Not ready${NC}"
        return 1
    fi
}

send_alert() {
    local message=$1

    if [ "$ALERT_ON_FAILURE" == "true" ] && [ -n "$ALERT_WEBHOOK" ]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 Health Check Alert\n$message\"}" >/dev/null 2>&1
    fi
}

# ==========================================
# Main Health Check
# ==========================================
print_header
echo ""

FAILED_CHECKS=0
TOTAL_CHECKS=0

# Check Docker containers
echo -e "${BLUE}Container Status:${NC}"
check_container "social-metrics-postgres" "PostgreSQL" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

check_container "social-metrics-api" "Core API" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

check_container "social-metrics-frontend" "Frontend" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

check_container "social-metrics-n8n" "n8n" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

check_container "social-metrics-nginx" "Nginx Gateway" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

echo ""

# Check database connectivity
echo -e "${BLUE}Database Connectivity:${NC}"
check_database || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

echo ""

# Check HTTP endpoints
echo -e "${BLUE}HTTP Endpoints:${NC}"
check_endpoint "http://localhost:3002/health" "Core API Health" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

check_endpoint "http://localhost:3000" "Frontend" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

check_endpoint "http://localhost:5678/healthz" "n8n Health" || ((FAILED_CHECKS++))
((TOTAL_CHECKS++))

echo ""

# Check resource usage
echo -e "${BLUE}Resource Usage:${NC}"
for container in $(docker ps --filter "name=social-metrics-" --format "{{.Names}}"); do
    stats=$(docker stats --no-stream --format "{{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" "$container")
    cpu=$(echo "$stats" | awk '{print $2}')
    mem=$(echo "$stats" | awk '{print $3}')
    echo -e "  $container: CPU: $cpu, Memory: $mem"
done

echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary:${NC}"

PASSED_CHECKS=$((TOTAL_CHECKS - FAILED_CHECKS))

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "  ${GREEN}✓ All checks passed ($PASSED_CHECKS/$TOTAL_CHECKS)${NC}"
    EXIT_CODE=0
else
    echo -e "  ${RED}✗ $FAILED_CHECKS of $TOTAL_CHECKS checks failed${NC}"
    send_alert "Health check failed: $FAILED_CHECKS of $TOTAL_CHECKS checks failed"
    EXIT_CODE=1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

exit $EXIT_CODE
