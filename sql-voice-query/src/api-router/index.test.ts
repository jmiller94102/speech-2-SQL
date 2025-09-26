/**
 * TESTS for api-router HTTP Service Layer
 *
 * RED PHASE: Define expected behavior through failing tests
 * Tests all HTTP endpoints, middleware, and service integration
 */

import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import { Service } from '@liquidmetal-ai/raindrop-framework';

// Mock the Raindrop Service base class
vi.mock('@liquidmetal-ai/raindrop-framework', () => ({
  Service: class MockService {
    ctx: any;
    env: any;
    constructor(ctx: any, env: any) {
      this.ctx = ctx;
      this.env = env;
    }
  }
}));

// Import after mocking
import ApiRouterService from './index';

// Mock environment with all required bindings
const mockEnv = {
  VOICE_PROCESSOR: {
    processAudio: vi.fn()
  },
  DATABASE_MANAGER: {
    executeQuery: vi.fn()
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
};

const mockCtx = {
  waitUntil: vi.fn()
};

describe('HTTP Service - POST /query Endpoint', () => {
  let service: ApiRouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiRouterService(mockCtx, mockEnv);
  });

  test('should process valid MP3 upload successfully', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const audioFile = new File([audioBuffer], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    // Mock successful processing chain
    mockEnv.VOICE_PROCESSOR.processAudio.mockResolvedValue({
      success: true,
      transcribedText: 'Show me all customers',
      naturalQuery: 'Show me all customers',
      confidence: 0.95,
      sessionId: expect.any(String),
      processingTime: 1500
    });

    mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
      success: true,
      queryExecuted: 'SELECT * FROM customers',
      results: JSON.stringify([{ id: 1, name: 'John Doe' }]),
      format: 'json',
      rowCount: 1,
      executionTime: 250,
      sessionId: expect.any(String)
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(responseData).toMatchObject({
      success: true,
      data: {
        transcription: 'Show me all customers',
        sql: 'SELECT * FROM customers',
        results: [{ id: 1, name: 'John Doe' }],
        executionTime: expect.any(Number)
      },
      timestamp: expect.any(String)
    });
  });

  test('should reject requests without audio file', async () => {
    const formData = new FormData();
    formData.append('text', 'some text');

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.stringContaining('Audio file is required'),
      code: 400,
      timestamp: expect.any(String)
    });
  });

  test('should reject non-MP3 files', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const audioFile = new File([audioBuffer], 'test.wav', {
      type: 'audio/wav'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.stringContaining('Only MP3 files are supported'),
      code: 400,
      timestamp: expect.any(String)
    });
  });

  test('should reject files larger than 10MB', async () => {
    const largeBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11MB
    const audioFile = new File([largeBuffer], 'large.mp3', {
      type: 'audio/mpeg'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(413);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.stringContaining('File size exceeds 10MB limit'),
      code: 413,
      timestamp: expect.any(String)
    });
  });

  test('should reject non-multipart requests', async () => {
    const request = new Request('http://localhost/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: 'data' })
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.stringContaining('multipart/form-data'),
      code: 400,
      timestamp: expect.any(String)
    });
  });

  test('should handle voice processor service failures', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const audioFile = new File([audioBuffer], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    mockEnv.VOICE_PROCESSOR.processAudio.mockRejectedValue(
      new Error('Voice processor unavailable')
    );

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(502);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.stringContaining('Voice processor'),
      code: 502,
      timestamp: expect.any(String)
    });
  });

  test('should handle database manager service failures', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const audioFile = new File([audioBuffer], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    mockEnv.VOICE_PROCESSOR.processAudio.mockResolvedValue({
      success: true,
      transcribedText: 'Show me data',
      naturalQuery: 'Show me data',
      confidence: 0.9,
      sessionId: 'test-session',
      processingTime: 1000
    });

    mockEnv.DATABASE_MANAGER.executeQuery.mockRejectedValue(
      new Error('Database connection failed')
    );

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(502);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.stringContaining('Database'),
      code: 502,
      timestamp: expect.any(String)
    });
  });

  test('should handle request timeout', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const audioFile = new File([audioBuffer], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    // Mock timeout scenario
    mockEnv.VOICE_PROCESSOR.processAudio.mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 100)
      )
    );

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(504);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.stringContaining('timeout'),
      code: 504,
      timestamp: expect.any(String)
    });
  });

  test('should include CORS headers', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const audioFile = new File([audioBuffer], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    mockEnv.VOICE_PROCESSOR.processAudio.mockResolvedValue({
      success: true,
      transcribedText: 'test',
      naturalQuery: 'test',
      confidence: 0.9,
      sessionId: 'test',
      processingTime: 100
    });

    mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
      success: true,
      queryExecuted: 'SELECT 1',
      results: '1',
      format: 'json',
      rowCount: 1,
      executionTime: 50,
      sessionId: 'test'
    });

    const response = await service.fetch(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });
});

describe('HTTP Service - GET /health Endpoint', () => {
  let service: ApiRouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiRouterService(mockCtx, mockEnv);
  });

  test('should return healthy status when all services are working', async () => {
    const request = new Request('http://localhost/health', {
      method: 'GET'
    });

    // Mock successful health checks
    mockEnv.VOICE_PROCESSOR.processAudio.mockResolvedValue({
      success: true,
      transcribedText: 'health check',
      naturalQuery: 'health check',
      confidence: 1.0,
      sessionId: 'health-check',
      processingTime: 100
    });

    mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
      success: true,
      queryExecuted: 'SELECT 1',
      results: '1',
      format: 'json',
      rowCount: 1,
      executionTime: 50,
      sessionId: 'health-check'
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toMatchObject({
      status: 'healthy',
      components: {
        voiceProcessor: {
          status: 'healthy',
          responseTime: expect.any(Number)
        },
        databaseManager: {
          status: 'healthy',
          responseTime: expect.any(Number)
        }
      },
      timestamp: expect.any(String),
      version: expect.any(String),
      uptime: expect.any(Number)
    });
  });

  test('should return degraded status when voice processor is down', async () => {
    const request = new Request('http://localhost/health', {
      method: 'GET'
    });

    mockEnv.VOICE_PROCESSOR.processAudio.mockRejectedValue(
      new Error('Service unavailable')
    );

    mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
      success: true,
      queryExecuted: 'SELECT 1',
      results: '1',
      format: 'json',
      rowCount: 1,
      executionTime: 50,
      sessionId: 'health-check'
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.status).toBe('degraded');
    expect(responseData.components.voiceProcessor.status).toBe('unhealthy');
    expect(responseData.components.databaseManager.status).toBe('healthy');
  });

  test('should return unhealthy status when all services are down', async () => {
    const request = new Request('http://localhost/health', {
      method: 'GET'
    });

    mockEnv.VOICE_PROCESSOR.processAudio.mockRejectedValue(
      new Error('Voice processor down')
    );

    mockEnv.DATABASE_MANAGER.executeQuery.mockRejectedValue(
      new Error('Database down')
    );

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(503);
    expect(responseData.status).toBe('unhealthy');
    expect(responseData.components.voiceProcessor.status).toBe('unhealthy');
    expect(responseData.components.databaseManager.status).toBe('unhealthy');
  });

  test('should include CORS headers for health endpoint', async () => {
    const request = new Request('http://localhost/health', {
      method: 'GET'
    });

    mockEnv.VOICE_PROCESSOR.processAudio.mockResolvedValue({
      success: true,
      transcribedText: 'health',
      naturalQuery: 'health',
      confidence: 1.0,
      sessionId: 'health',
      processingTime: 100
    });

    mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
      success: true,
      queryExecuted: 'SELECT 1',
      results: '1',
      format: 'json',
      rowCount: 1,
      executionTime: 50,
      sessionId: 'health'
    });

    const response = await service.fetch(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });
});

describe('HTTP Service - CORS Preflight', () => {
  let service: ApiRouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiRouterService(mockCtx, mockEnv);
  });

  test('should handle OPTIONS preflight requests', async () => {
    const request = new Request('http://localhost/query', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const response = await service.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });
});

describe('HTTP Service - Error Handling', () => {
  let service: ApiRouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiRouterService(mockCtx, mockEnv);
  });

  test('should return 404 for unknown endpoints', async () => {
    const request = new Request('http://localhost/unknown', {
      method: 'GET'
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData).toMatchObject({
      success: false,
      error: 'Endpoint not found',
      code: 404,
      timestamp: expect.any(String)
    });
  });

  test('should return 405 for unsupported methods', async () => {
    const request = new Request('http://localhost/query', {
      method: 'PUT'
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(405);
    expect(responseData).toMatchObject({
      success: false,
      error: 'Method not allowed',
      code: 405,
      timestamp: expect.any(String)
    });
  });

  test('should handle malformed requests gracefully', async () => {
    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: 'invalid form data'
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.any(String),
      code: 400,
      timestamp: expect.any(String)
    });
  });

  test('should handle internal server errors gracefully', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const audioFile = new File([audioBuffer], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const formData = new FormData();
    formData.append('audio', audioFile);

    const request = new Request('http://localhost/query', {
      method: 'POST',
      body: formData
    });

    // Mock unexpected error
    mockEnv.VOICE_PROCESSOR.processAudio.mockImplementation(() => {
      throw new Error('Unexpected internal error');
    });

    const response = await service.fetch(request);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toMatchObject({
      success: false,
      error: expect.any(String),
      code: 500,
      timestamp: expect.any(String)
    });
  });
});

describe('HTTP Service - Request Logging', () => {
  let service: ApiRouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiRouterService(mockCtx, mockEnv);
  });

  test('should log successful requests', async () => {
    const request = new Request('http://localhost/health', {
      method: 'GET'
    });

    mockEnv.VOICE_PROCESSOR.processAudio.mockResolvedValue({
      success: true,
      transcribedText: 'health',
      naturalQuery: 'health',
      confidence: 1.0,
      sessionId: 'health',
      processingTime: 100
    });

    mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
      success: true,
      queryExecuted: 'SELECT 1',
      results: '1',
      format: 'json',
      rowCount: 1,
      executionTime: 50,
      sessionId: 'health'
    });

    await service.fetch(request);

    expect(mockEnv.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Request processed'),
      expect.objectContaining({
        method: 'GET',
        path: '/health',
        status: 200
      })
    );
  });

  test('should log error requests', async () => {
    const request = new Request('http://localhost/unknown', {
      method: 'GET'
    });

    await service.fetch(request);

    expect(mockEnv.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Request failed'),
      expect.objectContaining({
        method: 'GET',
        path: '/unknown',
        status: 404
      })
    );
  });
});
