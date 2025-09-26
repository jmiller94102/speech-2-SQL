/**
 * COMPREHENSIVE TEST SUITE for database-manager Controller
 *
 * Testing Strategy: STRICT TDD RED -> GREEN -> REFACTOR
 *
 * TEST COVERAGE:
 * 1. Orchestrate natural language to SQL conversion
 * 2. Execute queries against SmartSQL database
 * 3. Process and format query results
 * 4. Handle database errors and retries
 * 5. Manage database initialization and mock data
 * 6. Integration with model layer and SmartSQL
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  QueryResult,
  ErrorResponse,
  DatabaseInitResult,
  TableMetadata
} from '../types/shared.js';

// Mock the model and environment
const mockModel = {
  executeNaturalQuery: vi.fn(),
  generateMockData: vi.fn(),
  createTables: vi.fn(),
  validateQuery: vi.fn(),
  formatResults: vi.fn(),
  getTableMetadata: vi.fn()
};

const mockEnv = {
  FINANCIAL_DATABASE: {
    executeQuery: vi.fn(),
    getMetadata: vi.fn(),
    updateMetadata: vi.fn(),
    getPiiData: vi.fn()
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
};

// Import the controller class that we'll implement
// This will fail initially as the class doesn't exist yet
let DatabaseController: any;

try {
  const controllerModule = await import('./controller.js');
  DatabaseController = controllerModule.DatabaseController;
} catch (error) {
  // Expected to fail during RED phase
  DatabaseController = class MockDatabaseController {
    constructor(model: any, env: any) {}
    async orchestrateQuery(naturalQuery: string, sessionId: string): Promise<QueryResult> { throw new Error('Not implemented'); }
    async initializeDatabase(): Promise<void> { throw new Error('Not implemented'); }
    async executeDirectQuery(sql: string): Promise<QueryResult> { throw new Error('Not implemented'); }
    handleDatabaseError(error: Error): ErrorResponse { throw new Error('Not implemented'); }
  };
}

describe('DatabaseController', () => {
  let controller: any;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new DatabaseController(mockModel, mockEnv);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with model and environment dependencies', () => {
      expect(controller).toBeDefined();
      expect(controller.model).toBe(mockModel);
      expect(controller.env).toBe(mockEnv);
    });

    it('should track initialization state', () => {
      expect(controller.isInitialized).toBe(false);
    });
  });

  describe('orchestrateQuery()', () => {
    const mockSessionId = 'test-session-123';
    const mockNaturalQuery = 'Show me all customers who spent more than $1000';

    beforeEach(() => {
      controller.isInitialized = true; // Skip initialization for these tests
    });

    it('should successfully orchestrate natural language query execution', async () => {
      const mockQueryResult: QueryResult = {
        success: true,
        queryExecuted: 'SELECT * FROM customers WHERE total_spent > 1000',
        results: '[{"id": 1, "name": "John Doe", "total_spent": 1500}]',
        format: 'json',
        rowCount: 1,
        executionTime: 250,
        sessionId: mockSessionId,
        aiReasoning: 'User wants customers with high spending'
      };

      mockModel.executeNaturalQuery.mockResolvedValue(mockQueryResult);

      const result = await controller.orchestrateQuery(mockNaturalQuery, mockSessionId);

      expect(mockModel.executeNaturalQuery).toHaveBeenCalledWith(mockNaturalQuery);
      expect(result).toEqual(mockQueryResult);
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Query orchestration completed successfully',
        expect.objectContaining({ sessionId: mockSessionId })
      );
    });

    it('should initialize database on first query if not initialized', async () => {
      controller.isInitialized = false;

      mockModel.createTables.mockResolvedValue(undefined);
      mockModel.generateMockData.mockResolvedValue(undefined);
      mockModel.executeNaturalQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM customers',
        results: '[]',
        format: 'json',
        rowCount: 0,
        executionTime: 100,
        sessionId: mockSessionId
      });

      await controller.orchestrateQuery(mockNaturalQuery, mockSessionId);

      expect(mockModel.createTables).toHaveBeenCalled();
      expect(mockModel.generateMockData).toHaveBeenCalled();
      expect(controller.isInitialized).toBe(true);
    });

    it('should handle query validation failures', async () => {
      mockModel.validateQuery = vi.fn().mockReturnValue(false);

      const result = await controller.orchestrateQuery('DROP TABLE customers', mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsafe query detected');
      expect(mockModel.executeNaturalQuery).not.toHaveBeenCalled();
    });

    it('should implement retry logic for SmartSQL failures', async () => {
      mockModel.executeNaturalQuery
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({
          success: true,
          queryExecuted: 'SELECT * FROM customers',
          results: '[]',
          format: 'json',
          rowCount: 0,
          executionTime: 150,
          sessionId: mockSessionId
        });

      const result = await controller.orchestrateQuery(mockNaturalQuery, mockSessionId);

      expect(mockModel.executeNaturalQuery).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(mockEnv.logger.warn).toHaveBeenCalledTimes(2); // For first two failures
    });

    it('should fail after maximum retry attempts', async () => {
      const persistentError = new Error('Persistent service failure');
      mockModel.executeNaturalQuery.mockRejectedValue(persistentError);

      const result = await controller.orchestrateQuery(mockNaturalQuery, mockSessionId);

      expect(mockModel.executeNaturalQuery).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent service failure');
    });

    it('should log all queries for audit trail', async () => {
      mockModel.executeNaturalQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM customers',
        results: '[]',
        format: 'json',
        rowCount: 0,
        executionTime: 100,
        sessionId: mockSessionId
      });

      await controller.orchestrateQuery(mockNaturalQuery, mockSessionId);

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Natural language query received',
        expect.objectContaining({
          naturalQuery: mockNaturalQuery,
          sessionId: mockSessionId
        })
      );

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'SQL query executed',
        expect.objectContaining({
          queryExecuted: 'SELECT * FROM customers',
          sessionId: mockSessionId
        })
      );
    });

    it('should return both SQL and results to caller', async () => {
      const mockQueryResult: QueryResult = {
        success: true,
        queryExecuted: 'SELECT name, email FROM customers LIMIT 5',
        results: '[{"name": "John", "email": "john@example.com"}]',
        format: 'json',
        rowCount: 1,
        executionTime: 200,
        sessionId: mockSessionId,
        aiReasoning: 'Showing sample customers'
      };

      mockModel.executeNaturalQuery.mockResolvedValue(mockQueryResult);

      const result = await controller.orchestrateQuery('Show me some customers', mockSessionId);

      expect(result.queryExecuted).toBe('SELECT name, email FROM customers LIMIT 5');
      expect(result.results).toBe('[{"name": "John", "email": "john@example.com"}]');
      expect(result.aiReasoning).toBe('Showing sample customers');
    });

    it('should handle timeout scenarios gracefully', async () => {
      const timeoutError = new Error('Query timeout after 30 seconds');
      mockModel.executeNaturalQuery.mockRejectedValue(timeoutError);

      const result = await controller.orchestrateQuery(
        'SELECT * FROM customers JOIN purchases ON customers.id = purchases.customer_id',
        mockSessionId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query timeout');

      // Should suggest simpler query for timeout
      expect(mockEnv.logger.warn).toHaveBeenCalledWith(
        'Query timeout detected, suggesting simpler query',
        expect.any(Object)
      );
    });
  });

  describe('initializeDatabase()', () => {
    it('should create tables and generate mock data', async () => {
      mockModel.createTables.mockResolvedValue(undefined);
      mockModel.generateMockData.mockResolvedValue(undefined);

      await controller.initializeDatabase();

      expect(mockModel.createTables).toHaveBeenCalled();
      expect(mockModel.generateMockData).toHaveBeenCalled();
      expect(controller.isInitialized).toBe(true);
      expect(mockEnv.logger.info).toHaveBeenCalledWith('Database initialized successfully');
    });

    it('should handle table creation failures', async () => {
      const createError = new Error('Failed to create customers table');
      mockModel.createTables.mockRejectedValue(createError);

      await expect(controller.initializeDatabase()).rejects.toThrow('Failed to create customers table');
      expect(controller.isInitialized).toBe(false);
      expect(mockEnv.logger.error).toHaveBeenCalledWith('Database initialization failed:', createError);
    });

    it('should handle mock data generation failures', async () => {
      mockModel.createTables.mockResolvedValue(undefined);
      mockModel.generateMockData.mockRejectedValue(new Error('Failed to generate customers'));

      await expect(controller.initializeDatabase()).rejects.toThrow('Failed to generate customers');
      expect(controller.isInitialized).toBe(false);
    });

    it('should skip initialization if already initialized', async () => {
      controller.isInitialized = true;

      await controller.initializeDatabase();

      expect(mockModel.createTables).not.toHaveBeenCalled();
      expect(mockModel.generateMockData).not.toHaveBeenCalled();
      expect(mockEnv.logger.info).toHaveBeenCalledWith('Database already initialized');
    });

    it('should track initialization timing', async () => {
      mockModel.createTables.mockResolvedValue(undefined);
      mockModel.generateMockData.mockResolvedValue(undefined);

      const startTime = Date.now();
      await controller.initializeDatabase();
      const endTime = Date.now();

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Database initialized successfully',
        expect.objectContaining({
          initializationTime: expect.any(Number)
        })
      );

      // Verify timing is reasonable
      const logCall = mockEnv.logger.info.mock.calls.find(call =>
        call[0] === 'Database initialized successfully'
      );
      const timing = logCall[1].initializationTime;
      expect(timing).toBeGreaterThanOrEqual(0);
      expect(timing).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });
  });

  describe('executeDirectQuery()', () => {
    const mockSessionId = 'direct-query-session';

    it('should execute direct SQL queries via SmartSQL', async () => {
      const mockSmartSQLResponse = {
        message: 'Query executed successfully',
        results: '[{"count": 50}]',
        status: 200,
        queryExecuted: 'SELECT COUNT(*) as count FROM customers'
      };

      mockEnv.FINANCIAL_DATABASE.executeQuery.mockResolvedValue(mockSmartSQLResponse);

      const result = await controller.executeDirectQuery('SELECT COUNT(*) as count FROM customers');

      expect(mockEnv.FINANCIAL_DATABASE.executeQuery).toHaveBeenCalledWith({
        sqlQuery: 'SELECT COUNT(*) as count FROM customers',
        format: 'json'
      });

      expect(result).toMatchObject({
        success: true,
        queryExecuted: 'SELECT COUNT(*) as count FROM customers',
        results: '[{"count": 50}]',
        format: 'json'
      });
    });

    it('should validate SQL before execution', async () => {
      const result = await controller.executeDirectQuery('DROP TABLE customers');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsafe query');
      expect(mockEnv.FINANCIAL_DATABASE.executeQuery).not.toHaveBeenCalled();
    });

    it('should handle SQL syntax errors', async () => {
      mockEnv.FINANCIAL_DATABASE.executeQuery.mockResolvedValue({
        message: 'SQL syntax error',
        status: 400,
        error: 'near "FORM": syntax error'
      });

      const result = await controller.executeDirectQuery('SELECT * FORM customers');

      expect(result.success).toBe(false);
      expect(result.error).toContain('SQL syntax error');
    });

    it('should support CSV format for direct queries', async () => {
      mockEnv.FINANCIAL_DATABASE.executeQuery.mockResolvedValue({
        message: 'Query executed successfully',
        results: 'id,name\n1,John\n2,Jane',
        status: 200,
        queryExecuted: 'SELECT id, name FROM customers'
      });

      const result = await controller.executeDirectQuery(
        'SELECT id, name FROM customers',
        'csv'
      );

      expect(mockEnv.FINANCIAL_DATABASE.executeQuery).toHaveBeenCalledWith({
        sqlQuery: 'SELECT id, name FROM customers',
        format: 'csv'
      });

      expect(result.format).toBe('csv');
      expect(result.results).toBe('id,name\n1,John\n2,Jane');
    });
  });

  describe('handleDatabaseError()', () => {
    it('should categorize SmartSQL service failures', () => {
      const serviceError = new Error('SmartSQL service unavailable');
      const errorResponse = controller.handleDatabaseError(serviceError);

      expect(errorResponse).toMatchObject({
        success: false,
        error: 'SmartSQL service unavailable',
        code: 503,
        timestamp: expect.any(String)
      });
    });

    it('should categorize query parsing errors', () => {
      const parseError = new Error('Failed to parse natural language query');
      const errorResponse = controller.handleDatabaseError(parseError);

      expect(errorResponse).toMatchObject({
        success: false,
        error: 'Failed to parse natural language query',
        code: 400,
        timestamp: expect.any(String)
      });
    });

    it('should categorize database timeout errors', () => {
      const timeoutError = new Error('Query execution timeout');
      const errorResponse = controller.handleDatabaseError(timeoutError);

      expect(errorResponse).toMatchObject({
        success: false,
        error: 'Query execution timeout',
        code: 504,
        timestamp: expect.any(String)
      });
    });

    it('should categorize permission errors', () => {
      const permissionError = new Error('Access denied to database');
      const errorResponse = controller.handleDatabaseError(permissionError);

      expect(errorResponse).toMatchObject({
        success: false,
        error: 'Access denied to database',
        code: 403,
        timestamp: expect.any(String)
      });
    });

    it('should provide specific field errors for validation failures', () => {
      const validationError = new Error('Invalid field: email must be valid format');
      const errorResponse = controller.handleDatabaseError(validationError);

      expect(errorResponse.details).toMatchObject({
        field: 'email',
        validationError: 'must be valid format'
      });
    });

    it('should include helpful error messages for common issues', () => {
      const connectionError = new Error('Database connection failed');
      const errorResponse = controller.handleDatabaseError(connectionError);

      expect(errorResponse.details).toMatchObject({
        helpfulMessage: expect.stringContaining('database connection'),
        suggestedActions: expect.arrayContaining([
          'Check database credentials',
          'Verify network connectivity',
          'Ensure database is running'
        ])
      });
    });
  });

  describe('Integration Tests', () => {
    it('should coordinate model and SmartSQL for complete query flow', async () => {
      const mockSessionId = 'integration-session';

      // Setup model to return successful result
      mockModel.executeNaturalQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM customers WHERE total_spent > 1000',
        results: '[{"id": 1, "name": "High Spender"}]',
        format: 'json',
        rowCount: 1,
        executionTime: 300,
        sessionId: mockSessionId,
        aiReasoning: 'Finding high-value customers'
      });

      controller.isInitialized = true;

      const result = await controller.orchestrateQuery(
        'Find customers who spent more than $1000',
        mockSessionId
      );

      expect(result.success).toBe(true);
      expect(result.queryExecuted).toContain('total_spent > 1000');
      expect(result.aiReasoning).toBe('Finding high-value customers');

      // Verify audit logging
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Natural language query received',
        expect.objectContaining({ sessionId: mockSessionId })
      );
    });

    it('should handle end-to-end error scenarios', async () => {
      const mockSessionId = 'error-session';

      mockModel.executeNaturalQuery.mockRejectedValue(
        new Error('SmartSQL AI model temporarily unavailable')
      );

      const result = await controller.orchestrateQuery(
        'Show me all customers',
        mockSessionId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('SmartSQL AI model temporarily unavailable');

      // Verify error is properly logged and categorized
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        'Query orchestration failed:',
        expect.any(Error)
      );
    });

    it('should manage database lifecycle across multiple queries', async () => {
      controller.isInitialized = false;

      // First query should initialize
      mockModel.createTables.mockResolvedValue(undefined);
      mockModel.generateMockData.mockResolvedValue(undefined);
      mockModel.executeNaturalQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT COUNT(*) FROM customers',
        results: '[{"count": 50}]',
        format: 'json',
        rowCount: 1,
        executionTime: 100,
        sessionId: 'session-1'
      });

      await controller.orchestrateQuery('How many customers?', 'session-1');

      expect(mockModel.createTables).toHaveBeenCalledTimes(1);
      expect(mockModel.generateMockData).toHaveBeenCalledTimes(1);

      // Second query should not re-initialize
      await controller.orchestrateQuery('Show me products', 'session-2');

      expect(mockModel.createTables).toHaveBeenCalledTimes(1);
      expect(mockModel.generateMockData).toHaveBeenCalledTimes(1);
    });
  });
});