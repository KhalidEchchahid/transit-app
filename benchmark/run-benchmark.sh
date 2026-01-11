#!/bin/bash
#
# RAPTOR Load Simulation Runner
# Runs comprehensive load tests against Go and NestJS backends
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${YELLOW}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         RAPTOR Load Simulation Test Suite                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if a port is listening
check_port() {
    nc -z localhost "$1" 2>/dev/null
    return $?
}

# Check prerequisites
echo -e "${CYAN}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null && ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: Neither pnpm nor npm is installed${NC}"
    exit 1
fi

# Install dependencies if needed
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing benchmark dependencies...${NC}"
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi
fi

# Check backend status
GO_RUNNING=false
NEST_RUNNING=false

if check_port 8081; then
    echo -e "${GREEN}✓ Go backend is running on port 8081${NC}"
    GO_RUNNING=true
else
    echo -e "${YELLOW}⚠ Go backend is not running on port 8081${NC}"
fi

if check_port 8080; then
    echo -e "${GREEN}✓ NestJS backend is running on port 8080${NC}"
    NEST_RUNNING=true
else
    echo -e "${YELLOW}⚠ NestJS backend is not running on port 8080${NC}"
fi

if [ "$GO_RUNNING" = false ] && [ "$NEST_RUNNING" = false ]; then
    echo -e "${RED}"
    echo "Neither backend is running!"
    echo ""
    echo "To start the backends:"
    echo "  Go:     cd $PROJECT_ROOT/backend && go run main.go"
    echo "  NestJS: cd $PROJECT_ROOT/nest-backend/transit-app && pnpm run start"
    echo -e "${NC}"
    
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Parse arguments
TEST_TYPE="${1:-full}"

echo ""
echo -e "${YELLOW}Starting load simulation...${NC}"
echo -e "${CYAN}Test type: ${TEST_TYPE}${NC}"
echo ""

case "$TEST_TYPE" in
    "quick")
        echo -e "${GREEN}Running quick benchmark (10 connections, 10s)...${NC}"
        node benchmark.js
        ;;
    "load")
        echo -e "${GREEN}Running full load simulation (50-2000 users)...${NC}"
        node load-simulation.js
        ;;
    "full"|*)
        echo -e "${GREEN}Running both benchmarks...${NC}"
        echo ""
        echo -e "${MAGENTA}=== Quick Benchmark ===${NC}"
        node benchmark.js
        echo ""
        echo -e "${MAGENTA}=== Load Simulation ===${NC}"
        node load-simulation.js
        ;;
esac

echo ""
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo -e "${CYAN}Results Summary:${NC}"
echo "  - Quick benchmark: Measures basic performance with low concurrency"
echo "  - Load simulation: Tests scalability with 50-2000 concurrent users"
echo ""
echo -e "${YELLOW}Tip: Run with 'quick', 'load', or 'full' argument:${NC}"
echo "  ./run-benchmark.sh quick  # Quick 10-connection test"
echo "  ./run-benchmark.sh load   # Full load simulation (50-2000 users)"
echo "  ./run-benchmark.sh full   # Both tests (default)"
