/**
 * TESTS for voice-processor index.ts Actor
 *
 * TDD RED PHASE: These tests should FAIL initially
 * Testing requirements from index.ts comments:
 * - Actor state management and persistence
 * - Public interface for voice processing
 * - AI model integration (Whisper, Llama)
 * - SmartMemory integration for context
 * - Error handling and logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceProcessor } from './index.js';
import { ActorState } from '@liquidmetal-ai/raindrop-framework';
import {
  ProcessingResult,
  ConversationContext,
  VoiceProcessorState,
  SessionInfo,
  ProcessingStats,
  ModelConnectionStatus
} from '../types/shared.js';

// Mock Raindrop framework dependencies
const mockActorState = {
  id: {
    toString: () => 'voice-processor-actor-123',
    name: 'test-actor'
  },
  storage: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    setAlarm: vi.fn(),
    getAlarm: vi.fn(),
    deleteAlarm: vi.fn()
  },
  waitUntil: vi.fn(),
  blockConcurrencyWhile: vi.fn()
} as unknown as ActorState;

const mockEnv = {
  AI: {
    run: vi.fn()
  },
  DATABASE_MANAGER: {
    executeQuery: vi.fn()
  },
  CONVERSATION_MEMORY: {
    putMemory: vi.fn(),
    getMemory: vi.fn(),
    searchMemory: vi.fn()
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
};

describe('VoiceProcessor Actor', () => {
  let voiceProcessor: VoiceProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    voiceProcessor = new VoiceProcessor(mockActorState, mockEnv);
  });

  describe('Actor Initialization', () => {
    it('should initialize with default state', async () => {
      const defaultState: VoiceProcessorState = {
        activeSessions: new Map(),
        processingStats: {
          totalRequests: 0,
          successfulTranscriptions: 0,
          failedTranscriptions: 0,
          totalAudioProcessed: 0,
          averageConfidence: 0,
          modelUsage: {}
        },
        modelConnections: {
          whisper: {
            available: false,
            latency: 0,
            lastUsed: 0,
            errorCount: 0
          },
          llama: {
            available: false,
            latency: 0,
            lastUsed: 0,
            errorCount: 0
          },
          lastHealthCheck: 0
        }
      };

      mockActorState.storage.get.mockResolvedValue(null);

      await voiceProcessor.initializeState();

      expect(mockActorState.storage.put).toHaveBeenCalledWith(
        'voice-processor-state',
        expect.objectContaining({
          processingStats: expect.objectContaining({
            totalRequests: 0
          })
        })
      );
    });

    it('should restore existing state from storage', async () => {
      const existingState: VoiceProcessorState = {
        activeSessions: new Map([
          ['session-1', {
            sessionId: 'session-1',
            userId: 'user-123',
            startTime: Date.now() - 5000,
            lastActivity: Date.now() - 1000,
            context: {
              sessionId: 'session-1',
              messages: [],
              metadata: {},
              createdAt: Date.now() - 5000,
              lastUpdatedAt: Date.now() - 1000
            },
            processingCount: 3
          }]
        ]),
        processingStats: {
          totalRequests: 15,
          successfulTranscriptions: 12,
          failedTranscriptions: 3,
          totalAudioProcessed: 120.5,
          averageConfidence: 0.87,
          modelUsage: {
            'whisper-large-v3-turbo': 12,
            'llama-3.3-70b': 10
          }
        },
        modelConnections: {
          whisper: {
            available: true,
            latency: 250,
            lastUsed: Date.now() - 2000,
            errorCount: 1
          },
          llama: {
            available: true,
            latency: 180,
            lastUsed: Date.now() - 1500,
            errorCount: 0
          },
          lastHealthCheck: Date.now() - 60000
        }
      };

      mockActorState.storage.get.mockResolvedValue(existingState);

      await voiceProcessor.initializeState();

      expect(voiceProcessor.getState()).toEqual(existingState);
    });

    it('should perform health check on AI models during initialization', async () => {
      mockActorState.storage.get.mockResolvedValue(null);
      mockEnv.AI.run
        .mockResolvedValueOnce({ status: 'healthy' }) // Whisper health check
        .mockResolvedValueOnce({ status: 'healthy' }); // Llama health check

      await voiceProcessor.initializeState();

      expect(mockEnv.AI.run).toHaveBeenCalledWith('whisper-large-v3-turbo', {
        audio: expect.any(Buffer),
        health_check: true
      });
      expect(mockEnv.AI.run).toHaveBeenCalledWith('llama-3.3-70b', {
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 10
      });
    });
  });

  describe('processAudio', () => {
    it('should process audio and return complete results', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const sessionId = 'session-process-audio';

      const expectedResult: ProcessingResult = {
        success: true,
        transcribedText: 'Show me all customers from New York',
        naturalQuery: 'Show me all customers from New York',
        confidence: 0.92,
        sessionId,
        processingTime: 1250,
        error: undefined
      };

      // Mock the controller.processVoiceToSQL function
      vi.doMock('./controller.js', () => ({
        processVoiceToSQL: vi.fn().mockResolvedValue(expectedResult)
      }));

      const result = await voiceProcessor.processAudio(audioBuffer, sessionId);

      expect(result).toEqual(expectedResult);
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Processing audio request',
        expect.objectContaining({
          sessionId,
          audioSize: audioBuffer.length
        })
      );
    });

    it('should update session information during processing', async () => {
      const audioBuffer = Buffer.from('session update test');
      const sessionId = 'session-update-test';

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map(),
        processingStats: {
          totalRequests: 0,
          successfulTranscriptions: 0,
          failedTranscriptions: 0,
          totalAudioProcessed: 0,
          averageConfidence: 0,
          modelUsage: {}
        },
        modelConnections: {
          whisper: { available: true, latency: 0, lastUsed: 0, errorCount: 0 },
          llama: { available: true, latency: 0, lastUsed: 0, errorCount: 0 },
          lastHealthCheck: Date.now()
        }
      });

      await voiceProcessor.processAudio(audioBuffer, sessionId);

      expect(mockActorState.storage.put).toHaveBeenCalledWith(
        'voice-processor-state',
        expect.objectContaining({
          activeSessions: expect.any(Map)
        })
      );
    });

    it('should handle processing failures gracefully', async () => {
      const audioBuffer = Buffer.from('failing audio');
      const sessionId = 'session-failure';

      // Mock controller to throw error
      vi.doMock('./controller.js', () => ({
        processVoiceToSQL: vi.fn().mockRejectedValue(new Error('Processing failed'))
      }));

      const result = await voiceProcessor.processAudio(audioBuffer, sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Processing failed');
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        'Audio processing failed',
        expect.objectContaining({
          sessionId,
          error: 'Processing failed'
        })
      );
    });

    it('should validate audio buffer before processing', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const sessionId = 'session-invalid-audio';

      const result = await voiceProcessor.processAudio(emptyBuffer, sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid audio buffer');
    });

    it('should track processing statistics', async () => {
      const audioBuffer = Buffer.from('stats tracking test');
      const sessionId = 'session-stats';

      const processingResult: ProcessingResult = {
        success: true,
        transcribedText: 'Test transcription',
        naturalQuery: 'Test transcription',
        confidence: 0.85,
        sessionId,
        processingTime: 800
      };

      vi.doMock('./controller.js', () => ({
        processVoiceToSQL: vi.fn().mockResolvedValue(processingResult)
      }));

      await voiceProcessor.processAudio(audioBuffer, sessionId);

      // Verify stats were updated
      const updatedState = voiceProcessor.getState();
      expect(updatedState.processingStats.totalRequests).toBeGreaterThan(0);
      expect(updatedState.processingStats.successfulTranscriptions).toBeGreaterThan(0);
    });
  });

  describe('getSessionContext', () => {
    it('should retrieve session context for active sessions', async () => {
      const sessionId = 'active-session';
      const sessionInfo: SessionInfo = {
        sessionId,
        userId: 'user-456',
        startTime: Date.now() - 10000,
        lastActivity: Date.now() - 1000,
        context: {
          sessionId,
          userId: 'user-456',
          messages: [
            {
              role: 'user',
              content: 'Previous query',
              timestamp: Date.now() - 5000
            }
          ],
          metadata: {},
          createdAt: Date.now() - 10000,
          lastUpdatedAt: Date.now() - 1000
        },
        processingCount: 2
      };

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map([[sessionId, sessionInfo]]),
        processingStats: {},
        modelConnections: {}
      });

      const result = await voiceProcessor.getSessionContext(sessionId);

      expect(result).toEqual(sessionInfo.context);
    });

    it('should return null for non-existent sessions', async () => {
      const sessionId = 'non-existent-session';

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map(),
        processingStats: {},
        modelConnections: {}
      });

      const result = await voiceProcessor.getSessionContext(sessionId);

      expect(result).toBeNull();
    });

    it('should retrieve context from SmartMemory for inactive sessions', async () => {
      const sessionId = 'inactive-session';
      const storedContext: ConversationContext = {
        sessionId,
        messages: [],
        metadata: {},
        createdAt: Date.now() - 3600000,
        lastUpdatedAt: Date.now() - 3600000
      };

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map(),
        processingStats: {},
        modelConnections: {}
      });

      mockEnv.CONVERSATION_MEMORY.getMemory.mockResolvedValue([
        {
          content: JSON.stringify(storedContext),
          session_id: sessionId
        }
      ]);

      const result = await voiceProcessor.getSessionContext(sessionId);

      expect(result).toEqual(storedContext);
    });
  });

  describe('clearSession', () => {
    it('should remove session from active sessions', async () => {
      const sessionId = 'session-to-clear';
      const sessionInfo: SessionInfo = {
        sessionId,
        startTime: Date.now() - 5000,
        lastActivity: Date.now(),
        context: {
          sessionId,
          messages: [],
          metadata: {},
          createdAt: Date.now() - 5000,
          lastUpdatedAt: Date.now()
        },
        processingCount: 1
      };

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map([[sessionId, sessionInfo]]),
        processingStats: {},
        modelConnections: {}
      });

      await voiceProcessor.clearSession(sessionId);

      expect(mockActorState.storage.put).toHaveBeenCalledWith(
        'voice-processor-state',
        expect.objectContaining({
          activeSessions: expect.any(Map)
        })
      );

      // Verify session was removed
      const state = voiceProcessor.getState();
      expect(state.activeSessions.has(sessionId)).toBe(false);
    });

    it('should store final context in SmartMemory before clearing', async () => {
      const sessionId = 'session-with-context';
      const sessionInfo: SessionInfo = {
        sessionId,
        startTime: Date.now() - 10000,
        lastActivity: Date.now(),
        context: {
          sessionId,
          messages: [
            {
              role: 'user',
              content: 'Important conversation',
              timestamp: Date.now() - 5000
            }
          ],
          metadata: { important: true },
          createdAt: Date.now() - 10000,
          lastUpdatedAt: Date.now()
        },
        processingCount: 3
      };

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map([[sessionId, sessionInfo]]),
        processingStats: {},
        modelConnections: {}
      });

      await voiceProcessor.clearSession(sessionId);

      expect(mockEnv.CONVERSATION_MEMORY.putMemory).toHaveBeenCalledWith({
        session_id: sessionId,
        content: JSON.stringify(sessionInfo.context),
        timeline: 'voice_conversation',
        key: `context_${sessionId}`
      });
    });

    it('should handle clearing non-existent sessions gracefully', async () => {
      const sessionId = 'non-existent-session';

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map(),
        processingStats: {},
        modelConnections: {}
      });

      await expect(voiceProcessor.clearSession(sessionId))
        .resolves.not.toThrow();
    });
  });

  describe('Actor Lifecycle Management', () => {
    it('should set up periodic cleanup alarms', async () => {
      await voiceProcessor.initializeState();

      expect(mockActorState.storage.setAlarm).toHaveBeenCalledWith(
        expect.any(Number)
      );
    });

    it('should clean up expired sessions on alarm', async () => {
      const expiredSessionId = 'expired-session';
      const activeSessionId = 'active-session';
      const now = Date.now();

      const expiredSession: SessionInfo = {
        sessionId: expiredSessionId,
        startTime: now - 3600000, // 1 hour ago
        lastActivity: now - 1800000, // 30 minutes ago (expired)
        context: {
          sessionId: expiredSessionId,
          messages: [],
          metadata: {},
          createdAt: now - 3600000,
          lastUpdatedAt: now - 1800000
        },
        processingCount: 1
      };

      const activeSession: SessionInfo = {
        sessionId: activeSessionId,
        startTime: now - 300000, // 5 minutes ago
        lastActivity: now - 60000, // 1 minute ago (active)
        context: {
          sessionId: activeSessionId,
          messages: [],
          metadata: {},
          createdAt: now - 300000,
          lastUpdatedAt: now - 60000
        },
        processingCount: 2
      };

      mockActorState.storage.get.mockResolvedValue({
        activeSessions: new Map([
          [expiredSessionId, expiredSession],
          [activeSessionId, activeSession]
        ]),
        processingStats: {},
        modelConnections: {}
      });

      await voiceProcessor.alarm();

      // Verify expired session was cleared but active one remains
      expect(mockEnv.CONVERSATION_MEMORY.putMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: expiredSessionId
        })
      );
    });

    it('should perform periodic model health checks', async () => {
      mockEnv.AI.run
        .mockResolvedValueOnce({ status: 'healthy' })
        .mockResolvedValueOnce({ status: 'healthy' });

      await voiceProcessor.performHealthCheck();

      expect(mockEnv.AI.run).toHaveBeenCalledTimes(2);
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Model health check completed',
        expect.objectContaining({
          whisperStatus: 'healthy',
          llamaStatus: 'healthy'
        })
      );
    });

    it('should handle model health check failures', async () => {
      mockEnv.AI.run
        .mockRejectedValueOnce(new Error('Whisper unavailable'))
        .mockResolvedValueOnce({ status: 'healthy' });

      await voiceProcessor.performHealthCheck();

      expect(mockEnv.logger.warn).toHaveBeenCalledWith(
        'Model health check failed',
        expect.objectContaining({
          model: 'whisper-large-v3-turbo',
          error: 'Whisper unavailable'
        })
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle storage failures during state persistence', async () => {
      const audioBuffer = Buffer.from('storage failure test');
      const sessionId = 'session-storage-fail';

      mockActorState.storage.put.mockRejectedValue(
        new Error('Storage service unavailable')
      );

      const result = await voiceProcessor.processAudio(audioBuffer, sessionId);

      // Should continue processing despite storage failure
      expect(result).toBeDefined();
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist state'),
        expect.any(Object)
      );
    });

    it('should implement circuit breaker pattern for failing models', async () => {
      const audioBuffer = Buffer.from('circuit breaker test');
      const sessionId = 'session-circuit-breaker';

      // Simulate repeated failures
      mockEnv.AI.run.mockRejectedValue(new Error('Model consistently failing'));

      // Multiple requests should trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await voiceProcessor.processAudio(audioBuffer, `${sessionId}-${i}`);
      }

      // Check if circuit breaker state was updated
      const state = voiceProcessor.getState();
      expect(state.modelConnections.whisper.errorCount).toBeGreaterThan(3);
    });

    it('should gracefully degrade on partial system failures', async () => {
      const audioBuffer = Buffer.from('partial failure test');
      const sessionId = 'session-partial-fail';

      // SmartMemory fails but processing continues
      mockEnv.CONVERSATION_MEMORY.putMemory.mockRejectedValue(
        new Error('Memory service down')
      );

      const result = await voiceProcessor.processAudio(audioBuffer, sessionId);

      // Processing should continue with degraded functionality
      expect(result).toBeDefined();
      expect(mockEnv.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store context'),
        expect.any(Object)
      );
    });
  });
});
