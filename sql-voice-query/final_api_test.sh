#!/bin/bash

# SQL Voice Query API Comprehensive Test Script
set -e

BASE_URL="https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Arrays for results
declare -a PASSING_TESTS
declare -a FAILING_TESTS

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local description="$6"

    ((TOTAL_TESTS++))

    echo -e "${BLUE}Testing:${NC} $name"
    echo "  Method: $method $endpoint"
    echo "  Expected: $expected_status"

    local response
    local status_code

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w '\n%{http_code}' -X "$method" -H 'Content-Type: application/json' -d "$data" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w '\n%{http_code}' -X "$method" -H 'Content-Type: application/json' "$BASE_URL$endpoint")
    fi

    status_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "  ${GREEN}✓ PASS${NC} - Status: $status_code"
        ((PASSED_TESTS++))
        PASSING_TESTS+=("$name - $method $endpoint - $status_code")

        # Additional validations
        case "$endpoint" in
            "/health")
                if [ "$status_code" = "200" ]; then
                    if echo "$body" | grep -q '"status".*"healthy"'; then
                        echo -e "  ${GREEN}✓ PASS${NC} - Valid health response format"
                    else
                        echo -e "  ${RED}✗ FAIL${NC} - Invalid health response format"
                        ((FAILED_TESTS++))
                        ((PASSED_TESTS--))
                        FAILING_TESTS+=("$name - Invalid response format")
                    fi
                fi
                ;;
            "/query")
                if [ "$status_code" = "400" ] && echo "$body" | grep -q '"error"'; then
                    echo -e "  ${GREEN}✓ PASS${NC} - Valid error response format"
                elif [ "$status_code" = "200" ] && echo "$body" | grep -q '"result"\|"transcript"'; then
                    echo -e "  ${GREEN}✓ PASS${NC} - Valid success response format"
                fi
                ;;
        esac
    else
        echo -e "  ${RED}✗ FAIL${NC} - Status: $status_code (Expected: $expected_status)"
        if [ -n "$body" ]; then
            echo "  Response: $body"
        fi
        ((FAILED_TESTS++))
        FAILING_TESTS+=("$name - $method $endpoint - Status $status_code (Expected $expected_status)")
    fi

    echo ""
}

echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}SQL Voice Query API - Comprehensive Endpoint Testing${NC}"
echo "════════════════════════════════════════════════════════════════"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Health Check (Expected: Working)
test_endpoint "Health Check" "GET" "/health" "" "200" "Basic health check endpoint"

# Test 2: Root endpoint (Expected: 404)
test_endpoint "Root Endpoint" "GET" "/" "" "404" "Root should return 404"

# Test 3: Valid Query with Audio (Expected: May work or fail depending on audio processing)
test_endpoint "Voice Query (Empty)" "POST" "/query" "{}" "400" "Empty query should return 400"

# Test 4: Query without audio
test_endpoint "Query Missing Audio" "POST" "/query" '{"format":"wav"}' "400" "Missing audio should return 400"

# Test 5: Query with invalid JSON
test_endpoint "Query Invalid JSON" "POST" "/query" "{invalid}" "400" "Invalid JSON should return 400"

# Test 6: Non-existent endpoint
test_endpoint "Non-existent Endpoint" "GET" "/nonexistent" "" "404" "Should return 404"

# Test 7: Wrong method on health
test_endpoint "Health POST Method" "POST" "/health" "{}" "404" "POST on health should return 404"

# Test 8: Wrong method on query
test_endpoint "Query GET Method" "GET" "/query" "" "404" "GET on query should return 404"

# Test 9: DELETE method on health
test_endpoint "Health DELETE Method" "DELETE" "/health" "" "404" "DELETE on health should return 404"

# Test 10: PUT method on query
test_endpoint "Query PUT Method" "PUT" "/query" "{}" "404" "PUT on query should return 404"

# Calculate results
SUCCESS_RATE=0
FAILURE_RATE=0

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
    FAILURE_RATE=$(echo "scale=1; $FAILED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
fi

# Final Results Summary
echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}                    TEST RESULTS SUMMARY${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}Total endpoints tested:${NC} $TOTAL_TESTS"
echo -e "${GREEN}Passing:${NC} $PASSED_TESTS (${SUCCESS_RATE}%)"
echo -e "${RED}Failing:${NC} $FAILED_TESTS (${FAILURE_RATE}%)"
echo ""

if [ ${#FAILING_TESTS[@]} -gt 0 ]; then
    echo -e "${RED}FAILING ENDPOINTS:${NC}"
    for test in "${FAILING_TESTS[@]}"; do
        echo "  • $test"
    done
    echo ""
fi

if [ ${#PASSING_TESTS[@]} -gt 0 ]; then
    echo -e "${GREEN}PASSING ENDPOINTS:${NC}"
    for test in "${PASSING_TESTS[@]}"; do
        echo "  • $test"
    done
    echo ""
fi

echo "════════════════════════════════════════════════════════════════"

# Exit with error code if any tests failed
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi