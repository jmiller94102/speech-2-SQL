#!/bin/bash

API_URL="https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run/query"

echo "Testing with minimal audio file..."

# Create a very simple 1-byte file to test the multipart upload
echo -n "a" > minimal_test.wav

echo "Response from minimal file:"
curl -v -X POST \
  -F "audio=@minimal_test.wav" \
  "$API_URL" \
  2>&1

# Clean up
rm -f minimal_test.wav

echo ""
echo "Test completed!"