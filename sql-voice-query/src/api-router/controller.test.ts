/**
 * TESTS for api-router Controller Layer
 *
 * RED PHASE: Define expected behavior through failing tests
 * Tests all coordination, processing, and service integration functions
 */

import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import {
  processVoiceRequest,
  handleHealthCheck,
  generateSessionId,
  HealthStatus
} from './controller';
import { AudioUpload, ProcessingResult, QueryResult } from '../types/shared';

// Mock environment for testing
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

describe('Controller - Voice Request Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processVoiceRequest', () => {
    test('should process valid audio upload successfully', async () => {
      const mockAudioUpload: AudioUpload = {
        file: Buffer.from('mock audio data'),
        mimeType: 'audio/mpeg',
        sessionId: 'test-session-123',
        metadata: {
          duration: 5.2,
          sampleRate: 44100,
          channels: 2
        }
      };

      const mockProcessingResult: ProcessingResult = {
        success: true,
        transcribedText: 'Show me all customers',
        naturalQuery: 'Show me all customers',
        confidence: 0.95,
        sessionId: 'test-session-123',
        processingTime: 1500
      };

      const mockQueryResult: QueryResult = {
        success: true,
        queryExecuted: 'SELECT * FROM customers',
        results: JSON.stringify([{ id: 1, name: 'John Doe' }]),
        format: 'json',
        rowCount: 1,
        executionTime: 250,
        sessionId: 'test-session-123'
      };

      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue(mockProcessingResult);
      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockResolvedValue(mockQueryResult);

      const result = await processVoiceRequest(mockAudioUpload, mockEnv);

      expect(result.success).toBe(true);
      expect(result.transcription).toBe('Show me all customers');
      expect(result.sql).toBe('SELECT * FROM customers');
      expect(result.results).toEqual([{ id: 1, name: 'John Doe' }]);
      expect(result.executionTime).toBeGreaterThan(0);

      expect(mockEnv.VOICE_PROCESSOR.processAudio).toHaveBeenCalledWith(
        mockAudioUpload.file,
        mockAudioUpload.sessionId
      );
      expect(mockEnv.DATABASE_MANAGER.executeQuery).toHaveBeenCalledWith(
        'Show me all customers',
        'test-session-123'
      );
    });

    test('should handle voice processor failure gracefully', async () => {
      const mockAudioUpload: AudioUpload = {
        file: Buffer.from('mock audio data'),
        mimeType: 'audio/mpeg',
        sessionId: 'test-session-456'
      };

      const mockProcessingResult: ProcessingResult = {
        success: false,
        transcribedText: '',
        naturalQuery: '',
        confidence: 0,
        sessionId: 'test-session-456',
        processingTime: 500,
        error: 'Audio transcription failed'
      };

      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue(mockProcessingResult);

      const result = await processVoiceRequest(mockAudioUpload, mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Audio transcription failed');
      expect(mockEnv.DATABASE_MANAGER.executeQuery).not.toHaveBeenCalled();
    });

    test('should handle database manager failure gracefully', async () => {
      const mockAudioUpload: AudioUpload = {
        file: Buffer.from('mock audio data'),
        mimeType: 'audio/mpeg',
        sessionId: 'test-session-789'
      };

      const mockProcessingResult: ProcessingResult = {
        success: true,
        transcribedText: 'Invalid SQL query',
        naturalQuery: 'Invalid SQL query',
        confidence: 0.8,
        sessionId: 'test-session-789',
        processingTime: 1000
      };

      const mockQueryResult: QueryResult = {
        success: false,
        queryExecuted: '',
        results: '',
        format: 'json',
        rowCount: 0,
        executionTime: 0,
        sessionId: 'test-session-789',
        error: 'SQL generation failed'
      };

      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue(mockProcessingResult);
      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockResolvedValue(mockQueryResult);

      const result = await processVoiceRequest(mockAudioUpload, mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SQL generation failed');
      expect(result.transcription).toBe('Invalid SQL query');
    });

    test('should handle service timeout errors', async () => {
      const mockAudioUpload: AudioUpload = {
        file: Buffer.from('mock audio data'),
        mimeType: 'audio/mpeg',
        sessionId: 'test-session-timeout'
      };

      // Mock timeout scenario
      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const result = await processVoiceRequest(mockAudioUpload, mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    test('should handle service unavailable errors', async () => {
      const mockAudioUpload: AudioUpload = {
        file: Buffer.from('mock audio data'),
        mimeType: 'audio/mpeg',
        sessionId: 'test-session-unavailable'
      };

      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      const result = await processVoiceRequest(mockAudioUpload, mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Voice processor service unavailable');
    });

    test('should track processing time accurately', async () => {
      const mockAudioUpload: AudioUpload = {
        file: Buffer.from('mock audio data'),
        mimeType: 'audio/mpeg',
        sessionId: 'test-session-timing'
      };

      const mockProcessingResult: ProcessingResult = {
        success: true,
        transcribedText: 'Test query',
        naturalQuery: 'Test query',
        confidence: 0.9,
        sessionId: 'test-session-timing',
        processingTime: 1000
      };

      const mockQueryResult: QueryResult = {
        success: true,
        queryExecuted: 'SELECT 1',
        results: '1',
        format: 'json',
        rowCount: 1,
        executionTime: 100,
        sessionId: 'test-session-timing'
      };

      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockProcessingResult), 50))
      );
      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockQueryResult), 25))
      );

      const startTime = Date.now();
      const result = await processVoiceRequest(mockAudioUpload, mockEnv);
      const endTime = Date.now();

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThanOrEqual(endTime - startTime + 10); // Small tolerance
    });
  });
});

describe('Controller - Health Check', () => {
  describe('handleHealthCheck', () => {
    test('should return healthy status when all services are available', async () => {
      // Mock successful health checks for all services
      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue({
        success: true,
        transcribedText: 'health check',
        naturalQuery: 'health check',
        confidence: 1.0,
        sessionId: 'health-check',
        processingTime: 100
      });

      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT 1',
        results: '1',
        format: 'json',
        rowCount: 1,
        executionTime: 50,
        sessionId: 'health-check'
      });

      const result = await handleHealthCheck(mockEnv);

      expect(result.status).toBe('healthy');
      expect(result.components.voiceProcessor.status).toBe('healthy');
      expect(result.components.databaseManager.status).toBe('healthy');
      expect(result.components.voiceProcessor.responseTime).toBeGreaterThan(0);
      expect(result.components.databaseManager.responseTime).toBeGreaterThan(0);
    });

    test('should return degraded status when voice processor is unavailable', async () => {
      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT 1',
        results: '1',
        format: 'json',
        rowCount: 1,
        executionTime: 50,
        sessionId: 'health-check'
      });

      const result = await handleHealthCheck(mockEnv);

      expect(result.status).toBe('degraded');
      expect(result.components.voiceProcessor.status).toBe('unhealthy');
      expect(result.components.databaseManager.status).toBe('healthy');
      expect(result.components.voiceProcessor.error).toBe('Service unavailable');
    });

    test('should return degraded status when database manager is unavailable', async () => {
      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue({
        success: true,
        transcribedText: 'health check',
        naturalQuery: 'health check',
        confidence: 1.0,
        sessionId: 'health-check',
        processingTime: 100
      });

      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await handleHealthCheck(mockEnv);

      expect(result.status).toBe('degraded');
      expect(result.components.voiceProcessor.status).toBe('healthy');
      expect(result.components.databaseManager.status).toBe('unhealthy');
      expect(result.components.databaseManager.error).toBe('Database connection failed');
    });

    test('should return unhealthy status when all services are unavailable', async () => {
      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockRejectedValue(
        new Error('Voice processor down')
      );

      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockRejectedValue(
        new Error('Database down')
      );

      const result = await handleHealthCheck(mockEnv);

      expect(result.status).toBe('unhealthy');
      expect(result.components.voiceProcessor.status).toBe('unhealthy');
      expect(result.components.databaseManager.status).toBe('unhealthy');
    });

    test('should include system information in health check', async () => {
      (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue({
        success: true,
        transcribedText: 'health check',
        naturalQuery: 'health check',
        confidence: 1.0,
        sessionId: 'health-check',
        processingTime: 100
      });

      (mockEnv.DATABASE_MANAGER.executeQuery as Mock).mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT 1',
        results: '1',
        format: 'json',
        rowCount: 1,
        executionTime: 50,
        sessionId: 'health-check'
      });

      const result = await handleHealthCheck(mockEnv);

      expect(result.timestamp).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Controller - Session Management', () => {
  describe('generateSessionId', () => {
    test('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    test('should generate session IDs with consistent format', () => {
      const sessionId = generateSessionId();

      // Should be a UUID-like format or timestamp-based
      expect(sessionId).toMatch(/^[a-zA-Z0-9\-_]+$/);
      expect(sessionId.length).toBeGreaterThan(10);
    });

    test('should generate URL-safe session IDs', () => {
      const sessionId = generateSessionId();

      // Should not contain unsafe characters
      expect(sessionId).not.toMatch(/[\/\?\#\[\]@!$&'()*+,;=]/);
    });
  });
});

describe('Controller - Error Handling', () => {
  test('should handle network errors gracefully', async () => {
    const mockAudioUpload: AudioUpload = {
      file: Buffer.from('mock audio data'),
      mimeType: 'audio/mpeg',
      sessionId: 'test-session-network'
    };

    (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockRejectedValue(
      new Error('ECONNREFUSED')
    );

    const result = await processVoiceRequest(mockAudioUpload, mockEnv);

    expect(result.success).toBe(false);
    expect(result.error).toContain('network');
  });

  test('should handle invalid service responses', async () => {
    const mockAudioUpload: AudioUpload = {
      file: Buffer.from('mock audio data'),
      mimeType: 'audio/mpeg',
      sessionId: 'test-session-invalid'
    };

    // Mock invalid response structure
    (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue({
      // Missing required fields
      success: true
    });

    const result = await processVoiceRequest(mockAudioUpload, mockEnv);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid response');
  });

  test('should handle concurrent request limits', async () => {
    const mockAudioUpload: AudioUpload = {
      file: Buffer.from('mock audio data'),
      mimeType: 'audio/mpeg',
      sessionId: 'test-session-concurrent'
    };

    // Simulate multiple concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      processVoiceRequest(mockAudioUpload, mockEnv)
    );

    (mockEnv.VOICE_PROCESSOR.processAudio as Mock).mockResolvedValue({
      success: true,
      transcribedText: 'test',
      naturalQuery: 'test',
      confidence: 0.9,
      sessionId: 'test-session-concurrent',
      processingTime: 100
    });

    const results = await Promise.all(promises);

    // Should handle all requests without failing
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  });
});