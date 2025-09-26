#!/bin/bash

API_URL="https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run"

echo "=== DEBUGGING VOICE QUERY API ==="
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
health_response=$(curl -s -X GET "$API_URL/health")
echo "Health Response: $health_response"
echo ""

# Test 2: Check if 404s work
echo "2. Testing 404 handling..."
not_found_response=$(curl -s -X GET "$API_URL/nonexistent" -w "HTTP_STATUS:%{http_code}")
echo "404 Test: $not_found_response"
echo ""

# Test 3: Check if OPTIONS works
echo "3. Testing CORS preflight..."
options_response=$(curl -s -X OPTIONS "$API_URL/query" -w "HTTP_STATUS:%{http_code}")
echo "OPTIONS Test: $options_response"
echo ""

# Test 4: Test POST without body (should fail gracefully)
echo "4. Testing POST without audio file..."
no_audio_response=$(curl -s -X POST "$API_URL/query" -H "Content-Type: application/json" -d '{}' -w "HTTP_STATUS:%{http_code}")
echo "No Audio Test: $no_audio_response"
echo ""

# Test 5: Test with minimal form data
echo "5. Testing with minimal audio file..."
echo -n "test" > minimal.wav
form_response=$(curl -s -X POST -F "audio=@minimal.wav" "$API_URL/query" -w "HTTP_STATUS:%{http_code}")
echo "Minimal Audio Test: $form_response"
rm -f minimal.wav
echo ""

echo "=== DEBUG COMPLETE ==="