/**
 * TESTS for voice-processor controller.ts
 *
 * TDD RED PHASE: These tests should FAIL initially
 * Testing requirements from controller.ts comments:
 * - Orchestrate audio transcription using Whisper
 * - Generate SQL queries using Llama 70B from transcription
 * - Coordinate with database-manager for query execution
 * - Manage conversation flow and context
 * - Handle AI model failures and retries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processVoiceToSQL,
  generateSQLFromText,
  executeQueryWorkflow
} from './controller.js';
import {
  ProcessingResult,
  QueryResult,
  ConversationContext,
  TranscriptionResult
} from '../types/shared.js';

// Mock dependencies
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
    warn: vi.fn()
  }
};

// Mock model functions
const mockModel = {
  transcribeAudio: vi.fn(),
  storeContext: vi.fn(),
  getContext: vi.fn(),
  validateTranscription: vi.fn()
};

describe('Voice Processor Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processVoiceToSQL', () => {
    it('should orchestrate complete voice-to-SQL pipeline', async () => {
      const audioBuffer = Buffer.from('audio data');
      const sessionId = 'session-123';

      const transcriptionResult: TranscriptionResult = {
        text: 'Show me all customers from California',
        confidence: 0.92,
        duration: 4.2
      };

      const sqlQuery = 'SELECT * FROM customers WHERE state = "California"';
      const queryResult: QueryResult = {
        success: true,
        queryExecuted: sqlQuery,
        results: JSON.stringify([{ id: 1, name: 'John Doe', state: 'California' }]),
        format: 'json',
        rowCount: 1,
        executionTime: 150,
        sessionId
      };

      mockModel.transcribeAudio.mockResolvedValue(transcriptionResult);
      mockModel.validateTranscription.mockReturnValue(true);
      mockModel.getContext.mockResolvedValue(null);
      mockEnv.AI.run.mockResolvedValue({ content: sqlQuery });
      mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue(queryResult);
      mockModel.storeContext.mockResolvedValue(undefined);

      const result = await processVoiceToSQL(audioBuffer, sessionId, mockEnv, mockModel);

      expect(result.success).toBe(true);
      expect(result.transcribedText).toBe(transcriptionResult.text);
      expect(result.naturalQuery).toBe(transcriptionResult.text);
      expect(result.confidence).toBe(transcriptionResult.confidence);
      expect(result.sessionId).toBe(sessionId);
      expect(result.processingTime).toBeGreaterThan(0);

      // Verify pipeline execution order
      expect(mockModel.transcribeAudio).toHaveBeenCalledBefore(mockEnv.AI.run as any);
      expect(mockEnv.AI.run).toHaveBeenCalledBefore(mockEnv.DATABASE_MANAGER.executeQuery as any);
    });

    it('should handle transcription failures with retries', async () => {
      const audioBuffer = Buffer.from('poor quality audio');
      const sessionId = 'session-retry';

      mockModel.transcribeAudio
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          text: 'Show customers',
          confidence: 0.75,
          duration: 2.0
        });

      mockModel.validateTranscription.mockReturnValue(true);
      mockModel.getContext.mockResolvedValue(null);
      mockEnv.AI.run.mockResolvedValue({ content: 'SELECT * FROM customers' });
      mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM customers',
        results: '[]',
        format: 'json',
        rowCount: 0,
        executionTime: 100,
        sessionId
      });

      const result = await processVoiceToSQL(audioBuffer, sessionId, mockEnv, mockModel);

      expect(result.success).toBe(true);
      expect(mockModel.transcribeAudio).toHaveBeenCalledTimes(3);
    });

    it('should reject low confidence transcriptions', async () => {
      const audioBuffer = Buffer.from('unclear audio');
      const sessionId = 'session-low-confidence';

      const lowConfidenceResult: TranscriptionResult = {
        text: 'unclear mumbling',
        confidence: 0.3,
        duration: 2.5
      };

      mockModel.transcribeAudio.mockResolvedValue(lowConfidenceResult);
      mockModel.validateTranscription.mockReturnValue(false);

      const result = await processVoiceToSQL(audioBuffer, sessionId, mockEnv, mockModel);

      expect(result.success).toBe(false);
      expect(result.error).toContain('confidence');
      expect(mockEnv.AI.run).not.toHaveBeenCalled();
    });

    it('should incorporate conversation context for better SQL generation', async () => {
      const audioBuffer = Buffer.from('follow-up query');
      const sessionId = 'session-context';

      const existingContext: ConversationContext = {
        sessionId,
        userId: 'user-123',
        messages: [
          {
            role: 'user',
            content: 'Show me customers from New York',
            timestamp: Date.now() - 5000
          },
          {
            role: 'assistant',
            content: 'Found 10 customers from New York',
            timestamp: Date.now() - 4000
          }
        ],
        metadata: {},
        createdAt: Date.now() - 10000,
        lastUpdatedAt: Date.now() - 4000
      };

      const transcriptionResult: TranscriptionResult = {
        text: 'Now show me those from California',
        confidence: 0.88,
        duration: 3.0
      };

      mockModel.transcribeAudio.mockResolvedValue(transcriptionResult);
      mockModel.validateTranscription.mockReturnValue(true);
      mockModel.getContext.mockResolvedValue(existingContext);
      mockEnv.AI.run.mockResolvedValue({
        content: 'SELECT * FROM customers WHERE state = "California"'
      });

      await processVoiceToSQL(audioBuffer, sessionId, mockEnv, mockModel);

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        'llama-3.3-70b',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('New York')
            })
          ])
        })
      );
    });

    it('should handle database query execution failures', async () => {
      const audioBuffer = Buffer.from('valid audio');
      const sessionId = 'session-db-error';

      const transcriptionResult: TranscriptionResult = {
        text: 'Show all products',
        confidence: 0.9,
        duration: 2.8
      };

      mockModel.transcribeAudio.mockResolvedValue(transcriptionResult);
      mockModel.validateTranscription.mockReturnValue(true);
      mockModel.getContext.mockResolvedValue(null);
      mockEnv.AI.run.mockResolvedValue({
        content: 'SELECT * FROM products'
      });
      mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
        success: false,
        queryExecuted: 'SELECT * FROM products',
        results: '',
        format: 'json',
        rowCount: 0,
        executionTime: 50,
        sessionId,
        error: 'Table does not exist'
      });

      const result = await processVoiceToSQL(audioBuffer, sessionId, mockEnv, mockModel);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database query failed');
    });
  });

  describe('generateSQLFromText', () => {
    it('should generate SQL using Llama 70B model', async () => {
      const transcription = 'Find all customers who bought products over $100';
      const context: ConversationContext = {
        sessionId: 'session-sql',
        messages: [],
        metadata: {},
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      const expectedSQL = `
        SELECT DISTINCT c.*
        FROM customers c
        JOIN purchases p ON c.id = p.customer_id
        WHERE p.total_amount > 100
      `;

      mockEnv.AI.run.mockResolvedValue({
        content: expectedSQL
      });

      const result = await generateSQLFromText(transcription, context, mockEnv);

      expect(mockEnv.AI.run).toHaveBeenCalledWith('llama-3.3-70b', {
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('database schema')
          }),
          expect.objectContaining({
            role: 'user',
            content: transcription
          })
        ]),
        max_tokens: 1000,
        temperature: 0.1
      });
      expect(result).toBe(expectedSQL.trim());
    });

    it('should retry SQL generation with fallback prompts on failure', async () => {
      const transcription = 'Complex query that initially fails';
      const context: ConversationContext = {
        sessionId: 'session-fallback',
        messages: [],
        metadata: {},
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      mockEnv.AI.run
        .mockRejectedValueOnce(new Error('Model overloaded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          content: 'SELECT * FROM customers LIMIT 10'
        });

      const result = await generateSQLFromText(transcription, context, mockEnv);

      expect(mockEnv.AI.run).toHaveBeenCalledTimes(3);
      expect(result).toBe('SELECT * FROM customers LIMIT 10');
    });

    it('should include conversation context for follow-up queries', async () => {
      const transcription = 'And those from Texas';
      const context: ConversationContext = {
        sessionId: 'session-followup',
        messages: [
          {
            role: 'user',
            content: 'Show customers from California',
            timestamp: Date.now() - 3000
          },
          {
            role: 'assistant',
            content: 'SELECT * FROM customers WHERE state = "California"',
            timestamp: Date.now() - 2000
          }
        ],
        metadata: {},
        createdAt: Date.now() - 5000,
        lastUpdatedAt: Date.now() - 2000
      };

      mockEnv.AI.run.mockResolvedValue({
        content: 'SELECT * FROM customers WHERE state = "Texas"'
      });

      await generateSQLFromText(transcription, context, mockEnv);

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        'llama-3.3-70b',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('California')
            })
          ])
        })
      );
    });

    it('should validate and sanitize generated SQL', async () => {
      const transcription = 'Delete all customers';
      const context: ConversationContext = {
        sessionId: 'session-dangerous',
        messages: [],
        metadata: {},
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      mockEnv.AI.run.mockResolvedValue({
        content: 'DELETE FROM customers'
      });

      await expect(generateSQLFromText(transcription, context, mockEnv))
        .rejects.toThrow('Dangerous SQL operation detected');
    });
  });

  describe('executeQueryWorkflow', () => {
    it('should execute SQL query through database manager', async () => {
      const sqlQuery = 'SELECT * FROM customers WHERE state = "Florida"';
      const sessionId = 'session-execute';

      const expectedResult: QueryResult = {
        success: true,
        queryExecuted: sqlQuery,
        results: JSON.stringify([
          { id: 1, name: 'Miami Customer', state: 'Florida' }
        ]),
        format: 'json',
        rowCount: 1,
        executionTime: 120,
        sessionId
      };

      mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue(expectedResult);

      const result = await executeQueryWorkflow(sqlQuery, sessionId, mockEnv);

      expect(mockEnv.DATABASE_MANAGER.executeQuery).toHaveBeenCalledWith(
        sqlQuery,
        sessionId
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle query timeout errors', async () => {
      const sqlQuery = 'SELECT COUNT(*) FROM customers';
      const sessionId = 'session-timeout';

      mockEnv.DATABASE_MANAGER.executeQuery.mockRejectedValue(
        new Error('Query timeout after 30 seconds')
      );

      const result = await executeQueryWorkflow(sqlQuery, sessionId, mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should provide query suggestions on syntax errors', async () => {
      const invalidSQL = 'SELCT * FROM customers';
      const sessionId = 'session-syntax-error';

      mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
        success: false,
        queryExecuted: invalidSQL,
        results: '',
        format: 'json',
        rowCount: 0,
        executionTime: 10,
        sessionId,
        error: 'Syntax error near "SELCT"'
      });

      const result = await executeQueryWorkflow(invalidSQL, sessionId, mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Syntax error');
    });

    it('should log query execution metrics', async () => {
      const sqlQuery = 'SELECT * FROM products ORDER BY price DESC LIMIT 5';
      const sessionId = 'session-metrics';

      mockEnv.DATABASE_MANAGER.executeQuery.mockResolvedValue({
        success: true,
        queryExecuted: sqlQuery,
        results: JSON.stringify([]),
        format: 'json',
        rowCount: 5,
        executionTime: 250,
        sessionId
      });

      await executeQueryWorkflow(sqlQuery, sessionId, mockEnv);

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Query executed successfully'),
        expect.objectContaining({
          sessionId,
          executionTime: 250,
          rowCount: 5
        })
      );
    });
  });

  describe('Error Handling and Retries', () => {
    it('should implement exponential backoff for AI model retries', async () => {
      const transcription = 'Test query for retry logic';
      const context: ConversationContext = {
        sessionId: 'session-backoff',
        messages: [],
        metadata: {},
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
      };

      const startTime = Date.now();

      mockEnv.AI.run
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockRejectedValueOnce(new Error('Service busy'))
        .mockResolvedValueOnce({
          content: 'SELECT * FROM customers'
        });

      await generateSQLFromText(transcription, context, mockEnv);

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThan(100); // Should have some delay from backoff
    });

    it('should handle concurrent request limits gracefully', async () => {
      const audioBuffer = Buffer.from('concurrent test audio');
      const sessionId = 'session-concurrent';

      mockModel.transcribeAudio.mockRejectedValue(
        new Error('Too many concurrent requests')
      );

      const result = await processVoiceToSQL(audioBuffer, sessionId, mockEnv, mockModel);

      expect(result.success).toBe(false);
      expect(result.error).toContain('concurrent');
    });

    it('should maintain partial results on pipeline failures', async () => {
      const audioBuffer = Buffer.from('partial failure test');
      const sessionId = 'session-partial';

      const transcriptionResult: TranscriptionResult = {
        text: 'Show all orders',
        confidence: 0.95,
        duration: 2.5
      };

      mockModel.transcribeAudio.mockResolvedValue(transcriptionResult);
      mockModel.validateTranscription.mockReturnValue(true);
      mockModel.getContext.mockResolvedValue(null);
      mockEnv.AI.run.mockRejectedValue(new Error('SQL generation failed'));

      const result = await processVoiceToSQL(audioBuffer, sessionId, mockEnv, mockModel);

      expect(result.success).toBe(false);
      expect(result.transcribedText).toBe(transcriptionResult.text);
      expect(result.confidence).toBe(transcriptionResult.confidence);
      expect(result.error).toContain('SQL generation failed');
    });
  });
});