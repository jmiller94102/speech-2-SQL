#!/bin/bash

API_URL="https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run/query"

echo "Testing intelligent intent detection..."
echo "======================================"

# Create a simple test audio file (silence)
echo "Creating test audio file..."
python3 -c "
import wave
import struct
import os

# Create a 2-second silence WAV file
sample_rate = 16000
duration = 2
filename = 'test_audio.wav'

with wave.open(filename, 'w') as wav_file:
    wav_file.setnchannels(1)  # mono
    wav_file.setsampwidth(2)  # 2 bytes per sample
    wav_file.setframerate(sample_rate)

    # Generate 2 seconds of silence with small variations for different buffer sizes
    for i in range(sample_rate * duration):
        # Add tiny variations to create different buffer characteristics
        value = int(100 * (i % 1000) / 1000)  # Small amplitude variation
        wav_file.writeframes(struct.pack('<h', value))

print(f'Created {filename} with {os.path.getsize(filename)} bytes')
"

# Test the query endpoint
echo ""
echo "Testing voice query with intelligent detection..."
echo "Response:"
curl -X POST \
  -F "audio=@test_audio.wav" \
  "$API_URL" \
  2>/dev/null | python3 -m json.tool

# Clean up
rm -f test_audio.wav

echo ""
echo "Test completed!"