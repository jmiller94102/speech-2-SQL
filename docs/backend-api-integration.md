# SQL Voice Query Backend API Integration Guide

## Overview

This document provides the complete integration specifications for connecting your frontend application to the SQL Voice Query backend service.

## Base Configuration

**Service URL:** `https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run`

**CORS:** Enabled for all origins (`*`)
**Content-Type Support:** `application/json`, `multipart/form-data`
**HTTP Methods:** `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

---

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Purpose:** Check system health and component status

**Request:**
```bash
curl -X GET https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run/health
```

**Response:**
```json
{
  "status": "healthy",
  "components": {
    "voiceProcessor": {
      "status": "healthy",
      "responseTime": 45
    },
    "databaseManager": {
      "status": "healthy",
      "responseTime": 23
    }
  },
  "timestamp": "2025-09-26T22:24:03.653Z"
}
```

**Status Codes:**
- `200` - Service is healthy
- `500` - Service is experiencing issues

---

### 2. Voice Query Processing

**Endpoint:** `POST /query`

**Purpose:** Process audio input and return transcription, SQL query, and results

**Request Format:**
- **Content-Type:** `multipart/form-data`
- **Required Field:** `audio` (audio file)

**Example Request:**
```javascript
const formData = new FormData();
formData.append('audio', audioFile);

fetch('https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run/query', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

**Success Response:**
```json
{
  "success": true,
  "transcription": "Show me all customers",
  "sql": "SELECT * FROM customers LIMIT 10",
  "results": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "total_spent": 1250.00
    },
    {
      "id": 2,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "total_spent": 890.50
    }
  ],
  "executionTime": "125ms",
  "sessionId": "1727389443653"
}
```

**Error Responses:**

*Missing Audio File:*
```json
{
  "success": false,
  "error": "Audio file required"
}
```

*Processing Error:*
```json
{
  "success": false,
  "error": "Processing failed"
}
```

**Status Codes:**
- `200` - Query processed successfully
- `400` - Invalid request (missing audio, malformed data)
- `500` - Internal server error

---

## Audio File Requirements

**Supported Formats:** MP3, WAV, OGG, M4A
**Max File Size:** 10MB (recommended)
**Sample Rate:** Any (16kHz+ recommended for best results)
**Channels:** Mono or Stereo

---

## Response Data Types

### QueryResponse Interface
```typescript
interface QueryResponse {
  success: boolean;
  transcription?: string;
  sql?: string;
  results?: any[];
  executionTime?: string;
  sessionId?: string;
  error?: string;
}
```

### HealthResponse Interface
```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    voiceProcessor: { status: string; responseTime: number };
    databaseManager: { status: string; responseTime: number };
  };
  timestamp: string;
}
```

---

## Frontend Integration Examples

### JavaScript/Fetch API
```javascript
// Health check
async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const health = await response.json();
    console.log('Service status:', health.status);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Voice query
async function submitVoiceQuery(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);

  try {
    const response = await fetch(`${API_BASE_URL}/query`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      console.log('Transcription:', result.transcription);
      console.log('SQL Query:', result.sql);
      console.log('Results:', result.results);
    } else {
      console.error('Query failed:', result.error);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}
```

### React Hook Example
```jsx
import { useState } from 'react';

const useVoiceQuery = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submitQuery = async (audioFile) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio', audioFile);

    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return { submitQuery, loading, result, error };
};
```

---

## Error Handling Best Practices

1. **Always check the `success` field** in responses before processing data
2. **Handle network timeouts** - queries may take 5-10 seconds for processing
3. **Validate audio files** before uploading to avoid 400 errors
4. **Implement retry logic** for temporary failures
5. **Show user feedback** during processing (loading states)

---

## Performance Notes

- **Expected response time:** 2-8 seconds for voice processing
- **Concurrent requests:** Service supports multiple simultaneous requests
- **Rate limiting:** No rate limits currently enforced
- **Caching:** Responses are not cached - each request processes fresh

---

## Testing

You can test the API endpoints using curl or any HTTP client:

```bash
# Test health endpoint
curl -X GET https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run/health

# Test query endpoint with audio file
curl -X POST \
  -F "audio=@your-audio-file.mp3" \
  https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run/query
```

---

## Support

For backend issues or questions, contact the backend development team with:
- Request details (endpoint, payload, headers)
- Response received
- Expected behavior
- Timestamp of the issue

**Service Status:** ✅ Live and operational
**Last Updated:** September 26, 2025