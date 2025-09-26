/**
 * TESTS for api-router Model Layer
 *
 * RED PHASE: Define expected behavior through failing tests
 * Tests all validation, formatting, and sanitization functions
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  validateAudioUpload,
  formatQueryResponse,
  validateRequest,
  formatErrorResponse,
  ValidationResult,
  ApiResponse,
  ErrorResponse
} from './model';
import { ProcessingResult, QueryResult } from '../types/shared';

describe('Model - Audio Upload Validation', () => {
  describe('validateAudioUpload', () => {
    test('should validate valid MP3 file successfully', () => {
      const mockFile = new File(['mock audio data'], 'test.mp3', {
        type: 'audio/mpeg'
      });

      const result = validateAudioUpload(mockFile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.format).toBe('audio/mpeg');
      expect(result.metadata.size).toBeGreaterThan(0);
    });

    test('should reject file larger than 10MB', () => {
      // Create mock file with size > 10MB
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11MB
      const mockFile = new File([largeBuffer], 'large.mp3', {
        type: 'audio/mpeg'
      });

      const result = validateAudioUpload(mockFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'size',
          message: 'File size exceeds 10MB limit',
          code: 'FILE_TOO_LARGE'
        })
      );
    });

    test('should reject non-MP3 file formats', () => {
      const mockFile = new File(['mock data'], 'test.wav', {
        type: 'audio/wav'
      });

      const result = validateAudioUpload(mockFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'format',
          message: 'Only MP3 files are supported',
          code: 'INVALID_FORMAT'
        })
      );
    });

    test('should reject files with no audio content', () => {
      const mockFile = new File([''], 'empty.mp3', {
        type: 'audio/mpeg'
      });

      const result = validateAudioUpload(mockFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'content',
          message: 'Audio file cannot be empty',
          code: 'EMPTY_FILE'
        })
      );
    });

    test('should reject files with invalid MIME types', () => {
      const mockFile = new File(['data'], 'test.mp3', {
        type: 'text/plain'
      });

      const result = validateAudioUpload(mockFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'mimeType',
          message: 'Invalid MIME type for MP3 file',
          code: 'INVALID_MIME_TYPE'
        })
      );
    });

    test('should extract audio metadata when available', () => {
      const mockFile = new File(['mock audio data'], 'test.mp3', {
        type: 'audio/mpeg'
      });

      const result = validateAudioUpload(mockFile);

      expect(result.metadata).toMatchObject({
        duration: expect.any(Number),
        size: expect.any(Number),
        format: 'audio/mpeg'
      });
    });
  });
});

describe('Model - Request Validation', () => {
  describe('validateRequest', () => {
    test('should validate multipart form data with audio field', async () => {
      const formData = new FormData();
      const audioFile = new File(['audio data'], 'test.mp3', {
        type: 'audio/mpeg'
      });
      formData.append('audio', audioFile);

      const mockRequest = new Request('http://localhost/query', {
        method: 'POST',
        body: formData
      });

      const result = await validateRequest(mockRequest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject requests without audio field', async () => {
      const formData = new FormData();
      formData.append('text', 'some text');

      const mockRequest = new Request('http://localhost/query', {
        method: 'POST',
        body: formData
      });

      const result = await validateRequest(mockRequest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'audio',
          message: 'Audio file is required',
          code: 'MISSING_AUDIO_FIELD'
        })
      );
    });

    test('should reject non-multipart requests', async () => {
      const mockRequest = new Request('http://localhost/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      const result = await validateRequest(mockRequest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'contentType',
          message: 'Request must be multipart/form-data',
          code: 'INVALID_CONTENT_TYPE'
        })
      );
    });

    test('should reject malformed requests', async () => {
      const mockRequest = new Request('http://localhost/query', {
        method: 'POST',
        body: 'invalid body'
      });

      const result = await validateRequest(mockRequest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Model - Response Formatting', () => {
  describe('formatQueryResponse', () => {
    test('should format successful query response with all data', () => {
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

      const response = formatQueryResponse({
        processing: mockProcessingResult,
        query: mockQueryResult
      });

      expect(response).toMatchObject({
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

    test('should format error response when processing fails', () => {
      const mockProcessingResult: ProcessingResult = {
        success: false,
        transcribedText: '',
        naturalQuery: '',
        confidence: 0,
        sessionId: 'test-session-123',
        processingTime: 500,
        error: 'Transcription failed'
      };

      const response = formatQueryResponse({
        processing: mockProcessingResult
      });

      expect(response).toMatchObject({
        success: false,
        error: 'Transcription failed',
        timestamp: expect.any(String)
      });
    });

    test('should format error response when query fails', () => {
      const mockProcessingResult: ProcessingResult = {
        success: true,
        transcribedText: 'Invalid query',
        naturalQuery: 'Invalid query',
        confidence: 0.8,
        sessionId: 'test-session-123',
        processingTime: 1000
      };

      const mockQueryResult: QueryResult = {
        success: false,
        queryExecuted: '',
        results: '',
        format: 'json',
        rowCount: 0,
        executionTime: 0,
        sessionId: 'test-session-123',
        error: 'SQL generation failed'
      };

      const response = formatQueryResponse({
        processing: mockProcessingResult,
        query: mockQueryResult
      });

      expect(response).toMatchObject({
        success: false,
        error: 'SQL generation failed',
        timestamp: expect.any(String)
      });
    });

    test('should include request ID when provided', () => {
      const mockProcessingResult: ProcessingResult = {
        success: true,
        transcribedText: 'Test query',
        naturalQuery: 'Test query',
        confidence: 0.9,
        sessionId: 'test-session-123',
        processingTime: 1000
      };

      const response = formatQueryResponse({
        processing: mockProcessingResult
      }, 'req-123');

      expect(response.requestId).toBe('req-123');
    });
  });

  describe('formatErrorResponse', () => {
    test('should format basic error with message and code', () => {
      const error = new Error('File too large');

      const response = formatErrorResponse(error, 413);

      expect(response).toMatchObject({
        success: false,
        error: 'File too large',
        code: 413,
        timestamp: expect.any(String)
      });
    });

    test('should include details when provided', () => {
      const error = new Error('Validation failed');
      const details = {
        field: 'audio',
        expectedFormat: 'mp3',
        actualFormat: 'wav'
      };

      const response = formatErrorResponse(error, 400, details);

      expect(response).toMatchObject({
        success: false,
        error: 'Validation failed',
        code: 400,
        details,
        timestamp: expect.any(String)
      });
    });

    test('should include request ID when provided', () => {
      const error = new Error('Server error');

      const response = formatErrorResponse(error, 500, undefined, 'req-456');

      expect(response.requestId).toBe('req-456');
    });

    test('should handle errors without message', () => {
      const error = new Error();

      const response = formatErrorResponse(error, 500);

      expect(response.error).toBe('Unknown error occurred');
    });
  });
});

describe('Model - Input Sanitization', () => {
  test('should sanitize file names to prevent path traversal', () => {
    const mockFile = new File(['data'], '../../../etc/passwd.mp3', {
      type: 'audio/mpeg'
    });

    const result = validateAudioUpload(mockFile);

    // Should extract safe filename
    expect(result.metadata.sanitizedName).toBe('passwd.mp3');
  });

  test('should limit file name length', () => {
    const longName = 'a'.repeat(300) + '.mp3';
    const mockFile = new File(['data'], longName, {
      type: 'audio/mpeg'
    });

    const result = validateAudioUpload(mockFile);

    expect(result.metadata.sanitizedName.length).toBeLessThanOrEqual(255);
  });

  test('should reject files with suspicious extensions', () => {
    const mockFile = new File(['data'], 'test.mp3.exe', {
      type: 'audio/mpeg'
    });

    const result = validateAudioUpload(mockFile);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'filename',
        code: 'SUSPICIOUS_FILENAME'
      })
    );
  });
});