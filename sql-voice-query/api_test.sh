#!/bin/bash

# SQL Voice Query API Test Script
# Tests all endpoints with comprehensive error handling and chained operations

set -e

# Configuration
BASE_URL="https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run"
TEMP_DIR="/tmp/sql-voice-query-test"
RESULTS_FILE="$TEMP_DIR/test_results.json"

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

# Create temp directory
mkdir -p "$TEMP_DIR"

# Initialize results file
echo '{"tests": [], "summary": {}}' > "$RESULTS_FILE"

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

# Warning logging
log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test function with comprehensive error handling
run_test() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local description="$6"

    ((TOTAL_TESTS++))

    log "Testing: $test_name"
    log "  Method: $method"
    log "  Endpoint: $endpoint"
    log "  Expected Status: $expected_status"
    log "  Description: $description"

    local url="$BASE_URL$endpoint"
    local temp_response="$TEMP_DIR/response_$TOTAL_TESTS.json"
    local temp_headers="$TEMP_DIR/headers_$TOTAL_TESTS.txt"

    # Build curl command
    local curl_cmd="curl -s -w '%{http_code}\n%{time_total}\n' -H 'Content-Type: application/json'"

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi

    curl_cmd="$curl_cmd -D '$temp_headers' '$url'"

    # Execute request
    local response
    local http_code
    local time_total

    if response=$(bash -c "$curl_cmd" 2>&1); then
        # Parse response (last two lines are http_code and time_total)
        local lines=()
        while IFS= read -r line; do
            lines+=("$line")
        done <<< "$response"

        local total_lines=${#lines[@]}
        if [ $total_lines -ge 2 ]; then
            http_code="${lines[$((total_lines-2))]}"
            time_total="${lines[$((total_lines-1))]}"

            # Join all lines except last two for response body
            local response_body=""
            for ((i=0; i<total_lines-2; i++)); do
                if [ $i -gt 0 ]; then
                    response_body+="\n"
                fi
                response_body+="${lines[$i]}"
            done
        else
            response_body="$response"
            http_code="0"
            time_total="0"
        fi

        # Save response body
        echo "$response_body" > "$temp_response"

        # Validate HTTP status
        if [ "$http_code" = "$expected_status" ]; then
            log_success "$test_name - Status Code: $http_code (Expected: $expected_status)"

            # Additional validations based on endpoint
            case "$endpoint" in
                "/health")
                    if echo "$response_body" | grep -q '"status".*"healthy"'; then
                        log_success "$test_name - Health check response format valid"
                    else
                        log_error "$test_name - Health check response format invalid: $response_body"
                        ((FAILED_TESTS++))
                        ((PASSED_TESTS--))
                    fi
                    ;;
                "/query")
                    if [ "$http_code" = "200" ]; then
                        if echo "$response_body" | grep -q '"result"'; then
                            log_success "$test_name - Query response contains result field"
                        else
                            log_error "$test_name - Query response missing result field: $response_body"
                        fi
                    fi
                    ;;
            esac

            # Log response time
            log "  Response Time: ${time_total}s"

        else
            log_error "$test_name - Status Code: $http_code (Expected: $expected_status)"
            log_error "  Response: $response_body"
        fi

        # Store test result
        local test_result="{
            \"name\": \"$test_name\",
            \"method\": \"$method\",
            \"endpoint\": \"$endpoint\",
            \"expected_status\": $expected_status,
            \"actual_status\": $http_code,
            \"passed\": $([ "$http_code" = "$expected_status" ] && echo true || echo false),
            \"response_time\": $time_total,
            \"description\": \"$description\"
        }"

    else
        log_error "$test_name - Request failed or timed out: $response"
        local test_result="{
            \"name\": \"$test_name\",
            \"method\": \"$method\",
            \"endpoint\": \"$endpoint\",
            \"expected_status\": $expected_status,
            \"actual_status\": 0,
            \"passed\": false,
            \"error\": \"Request failed or timed out\",
            \"description\": \"$description\"
        }"
    fi

    # Update results file
    local temp_file="$TEMP_DIR/temp_results.json"
    jq ".tests += [$test_result]" "$RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$RESULTS_FILE"

    echo ""
}

# Create sample audio file for testing (base64 encoded silence)
create_test_audio() {
    # Generate a small WAV file with 1 second of silence
    python3 -c "
import wave
import struct

with wave.open('$TEMP_DIR/test_audio.wav', 'wb') as wav_file:
    wav_file.setnchannels(1)  # mono
    wav_file.setsampwidth(2)  # 16-bit
    wav_file.setframerate(16000)  # 16kHz

    # 1 second of silence
    frames = 16000
    for i in range(frames):
        wav_file.writeframes(struct.pack('<h', 0))
"

    # Convert to base64
    base64 -i "$TEMP_DIR/test_audio.wav" > "$TEMP_DIR/test_audio_b64.txt"
}

# Start testing
log "Starting comprehensive API tests for SQL Voice Query system"
log "Base URL: $BASE_URL"
log "Test directory: $TEMP_DIR"
echo ""

# Test 1: Health Check
run_test "Health Check" "GET" "/health" "" "200" "Basic health check endpoint"

# Test 2: Health Check with trailing slash
run_test "Health Check (trailing slash)" "GET" "/health/" "" "200" "Health check with trailing slash"

# Test 3: Root endpoint (might redirect or return info)
run_test "Root Endpoint" "GET" "/" "" "404" "Root endpoint should return 404 or redirect"

# Create test audio file
log "Creating test audio file..."
create_test_audio
TEST_AUDIO_B64=$(cat "$TEMP_DIR/test_audio_b64.txt" | tr -d '\n')

# Test 4: Voice Query - Valid Request
run_test "Voice Query (Valid)" "POST" "/query" "{
    \"audio\": \"$TEST_AUDIO_B64\",
    \"format\": \"wav\"
}" "200" "Valid voice query with audio data"

# Test 5: Voice Query - Missing Audio
run_test "Voice Query (Missing Audio)" "POST" "/query" "{
    \"format\": \"wav\"
}" "400" "Query without audio data should return 400"

# Test 6: Voice Query - Invalid JSON
run_test "Voice Query (Invalid JSON)" "POST" "/query" "{invalid json}" "400" "Invalid JSON should return 400"

# Test 7: Voice Query - Empty Request
run_test "Voice Query (Empty)" "POST" "/query" "{}" "400" "Empty request should return 400"

# Test 8: Voice Query - Invalid Audio Format
run_test "Voice Query (Invalid Format)" "POST" "/query" "{
    \"audio\": \"invalid_base64\",
    \"format\": \"wav\"
}" "400" "Invalid base64 audio should return 400"

# Test 9: Voice Query - Unsupported Format
run_test "Voice Query (Unsupported Format)" "POST" "/query" "{
    \"audio\": \"$TEST_AUDIO_B64\",
    \"format\": \"mp3\"
}" "400" "Unsupported audio format should return 400"

# Test 10: Non-existent Endpoint
run_test "Non-existent Endpoint" "GET" "/nonexistent" "" "404" "Non-existent endpoint should return 404"

# Test 11: Method Not Allowed
run_test "Method Not Allowed" "DELETE" "/health" "" "405" "DELETE on health endpoint should return 405"

# Test 12: Large Payload (if applicable)
LARGE_AUDIO=$(python3 -c "import base64; print(base64.b64encode(b'0' * 10000).decode())")
run_test "Large Audio Payload" "POST" "/query" "{
    \"audio\": \"$LARGE_AUDIO\",
    \"format\": \"wav\"
}" "400" "Large payload should be handled appropriately"

# Calculate final results
SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
FAILURE_RATE=$(echo "scale=2; $FAILED_TESTS * 100 / $TOTAL_TESTS" | bc)

# Update summary in results file
jq ".summary = {
    \"total_tests\": $TOTAL_TESTS,
    \"passed\": $PASSED_TESTS,
    \"failed\": $FAILED_TESTS,
    \"success_rate\": $SUCCESS_RATE,
    \"failure_rate\": $FAILURE_RATE,
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}" "$RESULTS_FILE" > "$TEMP_DIR/final_results.json" && mv "$TEMP_DIR/final_results.json" "$RESULTS_FILE"

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
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}FAILING ENDPOINTS:${NC}"
    jq -r '.tests[] | select(.passed == false) | "  • \(.name) - \(.method) \(.endpoint) - Status: \(.actual_status // "timeout") (Expected: \(.expected_status))"' "$RESULTS_FILE"
    echo ""
fi

# List passing tests
if [ $PASSED_TESTS -gt 0 ]; then
    echo -e "${GREEN}PASSING ENDPOINTS:${NC}"
    jq -r '.tests[] | select(.passed == true) | "  • \(.name) - \(.method) \(.endpoint) - Status: \(.actual_status)"' "$RESULTS_FILE"
    echo ""
fi

echo "Detailed results saved to: $RESULTS_FILE"
echo ""

# Set exit code based on results
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi