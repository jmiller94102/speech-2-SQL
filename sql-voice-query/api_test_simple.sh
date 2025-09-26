#!/bin/bash

# SQL Voice Query API Test Script
# Tests all endpoints with comprehensive error handling

set -e

# Configuration
BASE_URL="https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run"
TEMP_DIR="/tmp/sql-voice-query-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Arrays to store test results
FAILING_TESTS=()
PASSING_TESTS=()

# Create temp directory
mkdir -p "$TEMP_DIR"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Success logging
log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_TESTS++))
}

# Error logging
log_error() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_TESTS++))
}

# Test function
run_test() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local description="$6"

    ((TOTAL_TESTS++))

    log "Testing: $test_name"

    local url="$BASE_URL$endpoint"
    local temp_response="$TEMP_DIR/response_$TOTAL_TESTS.txt"
    local temp_full="$TEMP_DIR/full_$TOTAL_TESTS.txt"

    # Build and execute curl command
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl -s -w '\n%{http_code}\n%{time_total}\n' \
             -X "$method" \
             -H 'Content-Type: application/json' \
             -d "$data" \
             "$url" > "$temp_full" 2>&1
    else
        curl -s -w '\n%{http_code}\n%{time_total}\n' \
             -X "$method" \
             -H 'Content-Type: application/json' \
             "$url" > "$temp_full" 2>&1
    fi

    # Parse response
    local response_lines=$(wc -l < "$temp_full")
    local http_code=$(tail -n 2 "$temp_full" | head -n 1)
    local time_total=$(tail -n 1 "$temp_full")
    local response_body=""

    if [ "$response_lines" -gt 2 ]; then
        response_body=$(head -n $((response_lines - 2)) "$temp_full")
    fi

    # Save clean response body
    echo "$response_body" > "$temp_response"

    # Validate HTTP status
    if [ "$http_code" = "$expected_status" ]; then
        log_success "$test_name - Status: $http_code (${time_total}s)"

        # Additional validations based on endpoint
        case "$endpoint" in
            "/health")
                if echo "$response_body" | grep -q '"status".*"healthy"'; then
                    log_success "$test_name - Valid health response format"
                    PASSING_TESTS+=("$test_name - $method $endpoint - $http_code")
                else
                    log_error "$test_name - Invalid health response format"
                    FAILING_TESTS+=("$test_name - $method $endpoint - Invalid response format")
                    ((FAILED_TESTS++))
                    ((PASSED_TESTS--))
                fi
                ;;
            "/query")
                if [ "$http_code" = "200" ]; then
                    if echo "$response_body" | grep -q '"result"\|"transcript"\|"query"'; then
                        log_success "$test_name - Valid query response format"
                        PASSING_TESTS+=("$test_name - $method $endpoint - $http_code")
                    else
                        log_error "$test_name - Missing expected response fields"
                        FAILING_TESTS+=("$test_name - $method $endpoint - Missing response fields")
                    fi
                else
                    PASSING_TESTS+=("$test_name - $method $endpoint - $http_code")
                fi
                ;;
            *)
                PASSING_TESTS+=("$test_name - $method $endpoint - $http_code")
                ;;
        esac
    else
        log_error "$test_name - Status: $http_code (Expected: $expected_status)"
        if [ -n "$response_body" ]; then
            log_error "  Response: $response_body"
        fi
        FAILING_TESTS+=("$test_name - $method $endpoint - Status $http_code (Expected $expected_status)")
    fi

    echo ""
}

# Create sample audio file for testing (base64 encoded silence)
create_test_audio() {
    # Create a simple base64 encoded WAV header + silence
    echo "UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==" > "$TEMP_DIR/test_audio_b64.txt"
}

# Start testing
log "Starting comprehensive API tests for SQL Voice Query system"
log "Base URL: $BASE_URL"
echo ""

# Test 1: Health Check
run_test "Health Check" "GET" "/health" "" "200" "Basic health check endpoint"

# Test 2: Root endpoint
run_test "Root Endpoint" "GET" "/" "" "404" "Root endpoint should return 404"

# Create test audio file
log "Creating test audio file..."
create_test_audio
TEST_AUDIO_B64=$(cat "$TEMP_DIR/test_audio_b64.txt")

# Test 3: Voice Query - Valid Request
run_test "Voice Query (Valid)" "POST" "/query" "{
    \"audio\": \"$TEST_AUDIO_B64\",
    \"format\": \"wav\"
}" "200" "Valid voice query with audio data"

# Test 4: Voice Query - Missing Audio
run_test "Voice Query (Missing Audio)" "POST" "/query" "{
    \"format\": \"wav\"
}" "400" "Query without audio data should return 400"

# Test 5: Voice Query - Invalid JSON
run_test "Voice Query (Invalid JSON)" "POST" "/query" "{invalid json}" "400" "Invalid JSON should return 400"

# Test 6: Voice Query - Empty Request
run_test "Voice Query (Empty)" "POST" "/query" "{}" "400" "Empty request should return 400"

# Test 7: Non-existent Endpoint
run_test "Non-existent Endpoint" "GET" "/nonexistent" "" "404" "Non-existent endpoint should return 404"

# Test 8: Method Not Allowed on Health
run_test "Method Not Allowed" "DELETE" "/health" "" "405" "DELETE on health endpoint should return 405"

# Test 9: Method Not Allowed on Query
run_test "Query Method Not Allowed" "GET" "/query" "" "405" "GET on query endpoint should return 405"

# Test 10: Large Invalid Payload
run_test "Large Invalid Payload" "POST" "/query" "{
    \"audio\": \"$(head -c 1000 /dev/zero | base64)\",
    \"format\": \"invalid\"
}" "400" "Large invalid payload should return 400"

# Calculate final results
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    FAILURE_RATE=$(echo "scale=1; $FAILED_TESTS * 100 / $TOTAL_TESTS" | bc)
else
    SUCCESS_RATE="0"
    FAILURE_RATE="0"
fi

# Print final summary
echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}                    TEST RESULTS SUMMARY${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}Total endpoints tested:${NC} $TOTAL_TESTS"
echo -e "${GREEN}Passing:${NC} $PASSED_TESTS (${SUCCESS_RATE}%)"
echo -e "${RED}Failing:${NC} $FAILED_TESTS (${FAILURE_RATE}%)"
echo ""

# List failing tests
if [ ${#FAILING_TESTS[@]} -gt 0 ]; then
    echo -e "${RED}FAILING ENDPOINTS:${NC}"
    for test in "${FAILING_TESTS[@]}"; do
        echo "  • $test"
    done
    echo ""
fi

# List passing tests
if [ ${#PASSING_TESTS[@]} -gt 0 ]; then
    echo -e "${GREEN}PASSING ENDPOINTS:${NC}"
    for test in "${PASSING_TESTS[@]}"; do
        echo "  • $test"
    done
    echo ""
fi

echo "Test files saved to: $TEMP_DIR"

# Set exit code based on results
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi