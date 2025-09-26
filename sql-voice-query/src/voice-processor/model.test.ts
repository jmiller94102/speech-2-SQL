/**
 * TESTS for voice-processor model.ts
 *
 * TDD RED PHASE: These tests should FAIL initially
 * Testing requirements from model.ts comments:
 * - Audio transcription using Whisper
 * - Conversation context storage in SmartMemory
 * - Transcription confidence validation
 * - Session state management
 * - Audio quality assessment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  transcribeAudio,
  storeContext,
  getContext,
  validateTranscription
} from './model.js';
import {
  TranscriptionResult,
  ConversationContext,
  AudioValidationResult
} from '../types/shared.js';

// Mock environment dependencies
const mockEnv = {
  AI: {
    run: vi.fn()
  },
  CONVERSATION_MEMORY: {
    putMemory: vi.fn(),
    getMemory: vi.fn(),
    searchMemory: vi.fn()
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
};

describe('Voice Processor Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transcribeAudio', () => {
    it('should transcribe MP3 audio using Whisper model', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const expectedResult: TranscriptionResult = {
        text: 'Show me all customers from New York',
        confidence: 0.95,
        language: 'en',
        duration: 3.5,
        segments: [
          {
            start: 0,
            end: 3.5,
            text: 'Show me all customers from New York',
            confidence: 0.95
          }
        ]
      };

      mockEnv.AI.run.mockResolvedValue({
        text: expectedResult.text,
        confidence: expectedResult.confidence,
        language: expectedResult.language,
        duration: expectedResult.duration,
        segments: expectedResult.segments
      });

      const result = await transcribeAudio(audioBuffer, mockEnv);

      expect(mockEnv.AI.run).toHaveBeenCalledWith('whisper-large-v3-turbo', {
        audio: audioBuffer,
        language: 'auto',
        response_format: 'json',
        temperature: 0.1
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle audio quality validation before transcription', async () => {
      const invalidAudioBuffer = Buffer.alloc(0); // Empty buffer

      await expect(transcribeAudio(invalidAudioBuffer, mockEnv))
        .rejects.toThrow('Audio buffer is empty or invalid');
    });

    it('should validate audio duration is under 60 seconds', async () => {
      const longAudioBuffer = Buffer.from('very long audio data');

      // Mock audio validation to return duration > 60s
      await expect(transcribeAudio(longAudioBuffer, mockEnv))
        .rejects.toThrow('Audio duration exceeds maximum limit of 60 seconds');
    });

    it('should retry transcription on failure up to 3 times', async () => {
      const audioBuffer = Buffer.from('audio data');

      mockEnv.AI.run
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          text: 'Success on third try',
          confidence: 0.8,
          duration: 2.0
        });

      const result = await transcribeAudio(audioBuffer, mockEnv);

      expect(mockEnv.AI.run).toHaveBeenCalledTimes(3);
      expect(result.text).toBe('Success on third try');
    });

    it('should reject transcription after 3 failed attempts', async () => {
      const audioBuffer = Buffer.from('audio data');

      mockEnv.AI.run
        .mockRejectedValue(new Error('Persistent failure'));

      await expect(transcribeAudio(audioBuffer, mockEnv))
        .rejects.toThrow('502 Bad Gateway');
    });
  });

  describe('storeContext', () => {
    it('should store conversation context in SmartMemory', async () => {
      const sessionId = 'session-123';
      const context: ConversationContext = {
        sessionId,
        userId: 'user-456',
        messages: [
          {
            role: 'user',
            content: 'Show me all customers',
            timestamp: Date.now(),
            metadata: {}
          }
        ],
        metadata: { source: 'voice' },
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      mockEnv.CONVERSATION_MEMORY.putMemory.mockResolvedValue(undefined);

      await storeContext(sessionId, context, mockEnv);

      expect(mockEnv.CONVERSATION_MEMORY.putMemory).toHaveBeenCalledWith({
        session_id: sessionId,
        content: JSON.stringify(context),
        timeline: 'voice_conversation',
        key: `context_${sessionId}`
      });
    });

    it('should handle storage failures gracefully', async () => {
      const sessionId = 'session-123';
      const context: ConversationContext = {
        sessionId,
        messages: [],
        metadata: {},
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      mockEnv.CONVERSATION_MEMORY.putMemory.mockRejectedValue(
        new Error('Storage failure')
      );

      await expect(storeContext(sessionId, context, mockEnv))
        .rejects.toThrow('Failed to store conversation context');
    });

    it('should validate session ID format before storage', async () => {
      const invalidSessionId = '';
      const context: ConversationContext = {
        sessionId: invalidSessionId,
        messages: [],
        metadata: {},
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      await expect(storeContext(invalidSessionId, context, mockEnv))
        .rejects.toThrow('Invalid session ID format');
    });
  });

  describe('getContext', () => {
    it('should retrieve conversation context from SmartMemory', async () => {
      const sessionId = 'session-123';
      const storedContext: ConversationContext = {
        sessionId,
        userId: 'user-456',
        messages: [
          {
            role: 'user',
            content: 'Previous query',
            timestamp: Date.now() - 1000,
            metadata: {}
          }
        ],
        metadata: {},
        createdAt: Date.now() - 2000,
        lastUpdatedAt: Date.now() - 1000
      };

      mockEnv.CONVERSATION_MEMORY.getMemory.mockResolvedValue([
        {
          content: JSON.stringify(storedContext),
          session_id: sessionId
        }
      ]);

      const result = await getContext(sessionId, mockEnv);

      expect(mockEnv.CONVERSATION_MEMORY.getMemory).toHaveBeenCalledWith({
        session_id: sessionId,
        key: `context_${sessionId}`
      });
      expect(result).toEqual(storedContext);
    });

    it('should return null for non-existent session', async () => {
      const sessionId = 'non-existent-session';

      mockEnv.CONVERSATION_MEMORY.getMemory.mockResolvedValue([]);

      const result = await getContext(sessionId, mockEnv);

      expect(result).toBeNull();
    });

    it('should handle corrupted context data gracefully', async () => {
      const sessionId = 'session-123';

      mockEnv.CONVERSATION_MEMORY.getMemory.mockResolvedValue([
        {
          content: 'invalid json data',
          session_id: sessionId
        }
      ]);

      const result = await getContext(sessionId, mockEnv);

      expect(result).toBeNull();
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse conversation context')
      );
    });
  });

  describe('validateTranscription', () => {
    it('should validate transcription meets minimum confidence threshold', () => {
      const validResult: TranscriptionResult = {
        text: 'Clear audio transcription',
        confidence: 0.85,
        duration: 3.0
      };

      const result = validateTranscription(validResult);

      expect(result).toBe(true);
    });

    it('should reject transcription below confidence threshold', () => {
      const lowConfidenceResult: TranscriptionResult = {
        text: 'Unclear audio',
        confidence: 0.5,
        duration: 2.0
      };

      const result = validateTranscription(lowConfidenceResult);

      expect(result).toBe(false);
    });

    it('should require minimum text length', () => {
      const shortTextResult: TranscriptionResult = {
        text: 'Hi',
        confidence: 0.95,
        duration: 1.0
      };

      const result = validateTranscription(shortTextResult);

      expect(result).toBe(false);
    });

    it('should validate audio duration is reasonable', () => {
      const suspiciousResult: TranscriptionResult = {
        text: 'This is a very long transcription for such a short audio',
        confidence: 0.95,
        duration: 0.1
      };

      const result = validateTranscription(suspiciousResult);

      expect(result).toBe(false);
    });

    it('should reject empty or whitespace-only transcriptions', () => {
      const emptyResult: TranscriptionResult = {
        text: '   ',
        confidence: 0.95,
        duration: 2.0
      };

      const result = validateTranscription(emptyResult);

      expect(result).toBe(false);
    });
  });

  describe('Audio Quality Assessment', () => {
    it('should assess audio metadata before processing', async () => {
      const audioBuffer = Buffer.from('audio with metadata');

      // Mock would validate audio format, sample rate, etc.
      mockEnv.AI.run.mockResolvedValue({
        text: 'Good quality audio',
        confidence: 0.9,
        duration: 3.0
      });

      const result = await transcribeAudio(audioBuffer, mockEnv);

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect corrupted audio files', async () => {
      const corruptedBuffer = Buffer.from('corrupted data');

      await expect(transcribeAudio(corruptedBuffer, mockEnv))
        .rejects.toThrow('400 Bad Request');
    });
  });

  describe('Session State Management', () => {
    it('should maintain session statistics', async () => {
      const sessionId = 'session-stats-test';
      const context: ConversationContext = {
        sessionId,
        messages: [],
        metadata: {
          totalTranscriptions: 5,
          averageConfidence: 0.87,
          totalAudioDuration: 45.2
        },
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      mockEnv.CONVERSATION_MEMORY.putMemory.mockResolvedValue(undefined);

      await storeContext(sessionId, context, mockEnv);

      expect(mockEnv.CONVERSATION_MEMORY.putMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('totalTranscriptions')
        })
      );
    });

    it('should enforce 24-hour context retention policy', async () => {
      const oldSessionId = 'old-session';
      const oldContext: ConversationContext = {
        sessionId: oldSessionId,
        messages: [],
        metadata: {},
        createdAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        lastUpdatedAt: Date.now() - (25 * 60 * 60 * 1000)
      };

      mockEnv.CONVERSATION_MEMORY.getMemory.mockResolvedValue([
        {
          content: JSON.stringify(oldContext),
          session_id: oldSessionId
        }
      ]);

      const result = await getContext(oldSessionId, mockEnv);

      expect(result).toBeNull(); // Should be expired
    });
  });
});