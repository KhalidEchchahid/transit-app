#!/bin/bash

# RAPTOR Routing Engine Benchmark
# Compares Go backend vs NestJS backend performance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GO_PORT=8081
NEST_PORT=8080
NUM_REQUESTS=100
CONCURRENT_REQUESTS=10

# Test routes (various origin-destination pairs in Casablanca)
declare -a TEST_ROUTES=(
    # Short routes
    "33.5879,-7.6339,33.5731,-7.5898"  # Mers Sultan to Garage Allal
    "33.5892,-7.6114,33.5750,-7.6050"  # City center
    "33.5950,-7.6200,33.5800,-7.6100"  # Northern route
    # Medium routes
    "33.6050,-7.6300,33.5600,-7.5800"  # North to South
    "33.5700,-7.6500,33.5900,-7.5700"  # West to East
    # Long routes
    "33.6100,-7.6400,33.5500,-7.5600"  # Cross-city
)

# Function to check if server is running
check_server() {
    local port=$1
    local name=$2
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}✗ $name is NOT running on port $port${NC}"
        return 1
    fi
}

# Function to run single benchmark
run_benchmark() {
    local url=$1
    local name=$2
    local requests=$3
    local concurrent=$4
    
    echo -e "${BLUE}Running $requests requests ($concurrent concurrent) to $name...${NC}"
    
    # Use Apache Bench (ab) if available, otherwise use curl with time
    if command -v ab &> /dev/null; then
        ab -n $requests -c $concurrent -q "$url" 2>/dev/null | grep -E "(Requests per second|Time per request|Failed requests)"
    else
        # Fallback to curl-based benchmark
        local total_time=0
        local success=0
        local failed=0
        
        for i in $(seq 1 $requests); do
            start=$(date +%s%N)
            if curl -s "$url" > /dev/null 2>&1; then
                ((success++))
            else
                ((failed++))
            fi
            end=$(date +%s%N)
            elapsed=$(( (end - start) / 1000000 ))
            total_time=$((total_time + elapsed))
        done
        
        avg_time=$((total_time / requests))
        rps=$(echo "scale=2; $requests / ($total_time / 1000)" | bc)
        
        echo "  Requests: $requests, Success: $success, Failed: $failed"
        echo "  Total time: ${total_time}ms"
        echo "  Avg time per request: ${avg_time}ms"
        echo "  Requests per second: ~${rps}"
    fi
}

# Function to run detailed benchmark with hyperfine
run_hyperfine_benchmark() {
    local go_url=$1
    local nest_url=$2
    local name=$3
    
    if command -v hyperfine &> /dev/null; then
        echo -e "\n${YELLOW}=== Detailed comparison: $name ===${NC}"
        hyperfine \
            --warmup 3 \
            --runs 20 \
            --export-json "/tmp/benchmark_${name}.json" \
            "curl -s '$go_url'" \
            "curl -s '$nest_url'" \
            2>/dev/null
    fi
}

# Print header
echo -e "${YELLOW}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         RAPTOR Routing Engine Benchmark                        ║"
echo "║         Go Backend vs NestJS Backend                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check servers
echo -e "\n${YELLOW}=== Checking servers ===${NC}"
GO_RUNNING=false
NEST_RUNNING=false

if check_server $GO_PORT "Go Backend"; then
    GO_RUNNING=true
fi

if check_server $NEST_PORT "NestJS Backend"; then
    NEST_RUNNING=true
fi

if [ "$GO_RUNNING" = false ] && [ "$NEST_RUNNING" = false ]; then
    echo -e "${RED}No backends are running. Please start at least one backend.${NC}"
    exit 1
fi

# Run benchmarks
echo -e "\n${YELLOW}=== Running Routing Benchmarks ===${NC}"

# Store results
declare -A GO_TIMES
declare -A NEST_TIMES

for route in "${TEST_ROUTES[@]}"; do
    IFS=',' read -r from_lat from_lon to_lat to_lon <<< "$route"
    route_name="${from_lat}_${to_lat}"
    
    echo -e "\n${BLUE}Route: ($from_lat, $from_lon) → ($to_lat, $to_lon)${NC}"
    
    # Test Go backend
    if [ "$GO_RUNNING" = true ]; then
        go_url="http://localhost:$GO_PORT/api/v1/route?from_lat=$from_lat&from_lon=$from_lon&to_lat=$to_lat&to_lon=$to_lon&time=30600&day=weekday"
        
        echo -e "${GREEN}Go Backend:${NC}"
        go_times=()
        for i in {1..10}; do
            start=$(date +%s%N)
            result=$(curl -s "$go_url")
            end=$(date +%s%N)
            elapsed=$(( (end - start) / 1000000 ))
            go_times+=($elapsed)
        done
        
        # Calculate average
        total=0
        for t in "${go_times[@]}"; do
            total=$((total + t))
        done
        go_avg=$((total / ${#go_times[@]}))
        GO_TIMES[$route_name]=$go_avg
        echo "  Average response time: ${go_avg}ms"
    fi
    
    # Test NestJS backend
    if [ "$NEST_RUNNING" = true ]; then
        nest_url="http://localhost:$NEST_PORT/api/v1/route?from_lat=$from_lat&from_lon=$from_lon&to_lat=$to_lat&to_lon=$to_lon&time=30600&day=weekday"
        
        echo -e "${GREEN}NestJS Backend:${NC}"
        nest_times=()
        for i in {1..10}; do
            start=$(date +%s%N)
            result=$(curl -s "$nest_url")
            end=$(date +%s%N)
            elapsed=$(( (end - start) / 1000000 ))
            nest_times+=($elapsed)
        done
        
        # Calculate average
        total=0
        for t in "${nest_times[@]}"; do
            total=$((total + t))
        done
        nest_avg=$((total / ${#nest_times[@]}))
        NEST_TIMES[$route_name]=$nest_avg
        echo "  Average response time: ${nest_avg}ms"
    fi
    
    # Compare if both running
    if [ "$GO_RUNNING" = true ] && [ "$NEST_RUNNING" = true ]; then
        if [ $go_avg -lt $nest_avg ]; then
            diff=$((nest_avg - go_avg))
            pct=$(echo "scale=1; ($diff * 100) / $nest_avg" | bc)
            echo -e "  ${GREEN}Go is ${diff}ms (${pct}%) faster${NC}"
        else
            diff=$((go_avg - nest_avg))
            pct=$(echo "scale=1; ($diff * 100) / $go_avg" | bc)
            echo -e "  ${GREEN}NestJS is ${diff}ms (${pct}%) faster${NC}"
        fi
    fi
done

# Summary
echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════════════╗"
echo "║                         SUMMARY                                 ║"
echo "╚════════════════════════════════════════════════════════════════╝${NC}"

if [ "$GO_RUNNING" = true ] && [ "$NEST_RUNNING" = true ]; then
    go_total=0
    nest_total=0
    count=0
    
    for route in "${!GO_TIMES[@]}"; do
        go_total=$((go_total + ${GO_TIMES[$route]}))
        nest_total=$((nest_total + ${NEST_TIMES[$route]}))
        ((count++))
    done
    
    go_avg=$((go_total / count))
    nest_avg=$((nest_total / count))
    
    echo -e "\nOverall Average Response Times:"
    echo -e "  ${GREEN}Go Backend:    ${go_avg}ms${NC}"
    echo -e "  ${GREEN}NestJS Backend: ${nest_avg}ms${NC}"
    
    if [ $go_avg -lt $nest_avg ]; then
        diff=$((nest_avg - go_avg))
        pct=$(echo "scale=1; ($diff * 100) / $nest_avg" | bc)
        echo -e "\n${GREEN}Winner: Go Backend is ${diff}ms (${pct}%) faster on average${NC}"
    else
        diff=$((go_avg - nest_avg))
        pct=$(echo "scale=1; ($diff * 100) / $go_avg" | bc)
        echo -e "\n${GREEN}Winner: NestJS Backend is ${diff}ms (${pct}%) faster on average${NC}"
    fi
fi

echo -e "\n${YELLOW}Benchmark completed!${NC}"
