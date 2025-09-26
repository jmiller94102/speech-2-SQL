/**
 * COMPREHENSIVE TEST SUITE for database-manager Service
 *
 * Testing Strategy: STRICT TDD RED -> GREEN -> REFACTOR
 *
 * TEST COVERAGE:
 * 1. Private service fetch() returning "not implemented"
 * 2. Public methods for database operations
 * 3. Database initialization on startup
 * 4. Error handling and logging
 * 5. Service-to-service communication interface
 * 6. Integration with controller and model layers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  QueryResult,
  TableMetadata,
  ErrorResponse
} from '../types/shared.js';

// Mock the controller and dependencies
const mockController = {
  orchestrateQuery: vi.fn(),
  initializeDatabase: vi.fn(),
  executeDirectQuery: vi.fn(),
  handleDatabaseError: vi.fn()
};

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

// Mock Request and Response for Service testing
class MockRequest {
  constructor(public url: string, public options: any = {}) {}

  get method() {
    return this.options.method || 'GET';
  }

  get headers() {
    return new Map(Object.entries(this.options.headers || {}));
  }

  async json() {
    return this.options.body ? JSON.parse(this.options.body) : {};
  }

  async text() {
    return this.options.body || '';
  }
}

// Import the service class that we'll implement
// This will fail initially as the class doesn't exist yet
let DatabaseManagerService: any;

try {
  const serviceModule = await import('./index.js');
  DatabaseManagerService = serviceModule.default;
} catch (error) {
  // Expected to fail during RED phase
  DatabaseManagerService = class MockDatabaseManagerService {
    constructor(ctx: any, env: any) {}
    async fetch(request: Request): Promise<Response> { throw new Error('Not implemented'); }
    async executeQuery(naturalQuery: string, sessionId: string): Promise<QueryResult> { throw new Error('Not implemented'); }
    async initializeDatabase(): Promise<void> { throw new Error('Not implemented'); }
    async getTableInfo(): Promise<TableMetadata[]> { throw new Error('Not implemented'); }
    async healthCheck(): Promise<boolean> { throw new Error('Not implemented'); }
  };
}

describe('DatabaseManagerService', () => {
  let service: any;
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    };

    service = new DatabaseManagerService(mockCtx, mockEnv);

    // Inject mocked dependencies
    service.controller = mockController;
    service.model = mockModel;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize with execution context and environment', () => {
      expect(service).toBeDefined();
      expect(service.ctx).toBe(mockCtx);
      expect(service.env).toBe(mockEnv);
    });

    it('should initialize controller and model dependencies', () => {
      // Mock the actual initialization
      service.initializeDependencies();

      expect(service.controller).toBeDefined();
      expect(service.model).toBeDefined();
    });

    it('should auto-initialize database on first service creation', async () => {
      mockController.initializeDatabase.mockResolvedValue(undefined);

      await service.ensureInitialized();

      expect(mockController.initializeDatabase).toHaveBeenCalled();
      expect(service.isInitialized).toBe(true);
    });
  });

  describe('fetch() - Private Service Interface', () => {
    it('should return "not implemented" response as required', async () => {
      const mockRequest = new MockRequest('https://database-manager.service.com/');

      const response = await service.fetch(mockRequest);

      expect(response).toBeInstanceOf(Response);

      const responseText = await response.text();
      expect(responseText).toBe('Request received');

      // Verify it's not actually processing the request
      expect(mockController.orchestrateQuery).not.toHaveBeenCalled();
    });

    it('should log private fetch requests for monitoring', async () => {
      const mockRequest = new MockRequest('https://database-manager.service.com/query');

      await service.fetch(mockRequest);

      expect(mockEnv.logger.warn).toHaveBeenCalledWith(
        'Private service fetch() called - use public methods instead',
        expect.objectContaining({
          url: 'https://database-manager.service.com/query',
          method: 'GET'
        })
      );
    });

    it('should handle different HTTP methods in fetch', async () => {
      const postRequest = new MockRequest('https://database-manager.service.com/', {
        method: 'POST',
        body: '{"query": "test"}'
      });

      const response = await service.fetch(postRequest);
      expect(response.status).toBe(200);

      const responseText = await response.text();
      expect(responseText).toBe('Request received');
    });
  });

  describe('executeQuery() - Public Method', () => {
    const mockSessionId = 'public-session-123';
    const mockNaturalQuery = 'Show me all customers from California';

    beforeEach(() => {
      service.isInitialized = true; // Skip auto-initialization for these tests
    });

    it('should execute natural language queries via controller', async () => {
      const mockQueryResult: QueryResult = {
        success: true,
        queryExecuted: 'SELECT * FROM customers WHERE state = "CA"',
        results: '[{"id": 1, "name": "Alice", "state": "CA"}]',
        format: 'json',
        rowCount: 1,
        executionTime: 150,
        sessionId: mockSessionId,
        aiReasoning: 'Filtering customers by California state'
      };

      mockController.orchestrateQuery.mockResolvedValue(mockQueryResult);

      const result = await service.executeQuery(mockNaturalQuery, mockSessionId);

      expect(mockController.orchestrateQuery).toHaveBeenCalledWith(
        mockNaturalQuery,
        mockSessionId
      );
      expect(result).toEqual(mockQueryResult);
    });

    it('should initialize database on first query if needed', async () => {
      service.isInitialized = false;

      mockController.initializeDatabase.mockResolvedValue(undefined);
      mockController.orchestrateQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM customers',
        results: '[]',
        format: 'json',
        rowCount: 0,
        executionTime: 100,
        sessionId: mockSessionId
      });

      await service.executeQuery(mockNaturalQuery, mockSessionId);

      expect(mockController.initializeDatabase).toHaveBeenCalled();
      expect(service.isInitialized).toBe(true);
    });

    it('should handle controller errors gracefully', async () => {
      const controllerError = new Error('SmartSQL service unavailable');
      mockController.orchestrateQuery.mockRejectedValue(controllerError);

      mockController.handleDatabaseError.mockReturnValue({
        success: false,
        error: 'SmartSQL service unavailable',
        code: 503,
        timestamp: new Date().toISOString()
      });

      const result = await service.executeQuery(mockNaturalQuery, mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SmartSQL service unavailable');
      expect(mockController.handleDatabaseError).toHaveBeenCalledWith(controllerError);
    });

    it('should validate input parameters', async () => {
      // Test empty query
      await expect(service.executeQuery('', mockSessionId))
        .rejects.toThrow('Natural query cannot be empty');

      // Test empty session ID
      await expect(service.executeQuery(mockNaturalQuery, ''))
        .rejects.toThrow('Session ID cannot be empty');

      // Test null/undefined inputs
      await expect(service.executeQuery(null, mockSessionId))
        .rejects.toThrow('Natural query cannot be empty');

      await expect(service.executeQuery(mockNaturalQuery, null))
        .rejects.toThrow('Session ID cannot be empty');
    });

    it('should log all public method calls for audit trail', async () => {
      mockController.orchestrateQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM customers',
        results: '[]',
        format: 'json',
        rowCount: 0,
        executionTime: 100,
        sessionId: mockSessionId
      });

      await service.executeQuery(mockNaturalQuery, mockSessionId);

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Public executeQuery called',
        expect.objectContaining({
          naturalQuery: mockNaturalQuery,
          sessionId: mockSessionId
        })
      );
    });
  });

  describe('initializeDatabase() - Public Method', () => {
    it('should delegate to controller for database initialization', async () => {
      mockController.initializeDatabase.mockResolvedValue(undefined);

      await service.initializeDatabase();

      expect(mockController.initializeDatabase).toHaveBeenCalled();
      expect(service.isInitialized).toBe(true);
    });

    it('should handle initialization failures', async () => {
      const initError = new Error('Failed to create database tables');
      mockController.initializeDatabase.mockRejectedValue(initError);

      await expect(service.initializeDatabase()).rejects.toThrow('Failed to create database tables');
      expect(service.isInitialized).toBe(false);
    });

    it('should skip re-initialization if already initialized', async () => {
      service.isInitialized = true;

      await service.initializeDatabase();

      expect(mockController.initializeDatabase).not.toHaveBeenCalled();
      expect(mockEnv.logger.info).toHaveBeenCalledWith('Database already initialized');
    });

    it('should track initialization timing', async () => {
      mockController.initializeDatabase.mockResolvedValue(undefined);

      const startTime = Date.now();
      await service.initializeDatabase();
      const endTime = Date.now();

      const logCall = mockEnv.logger.info.mock.calls.find(call =>
        call[0] === 'Database initialization completed'
      );

      expect(logCall).toBeDefined();
      expect(logCall[1].initializationTime).toBeGreaterThanOrEqual(0);
      expect(logCall[1].initializationTime).toBeLessThan(endTime - startTime + 100);
    });
  });

  describe('getTableInfo() - Public Method', () => {
    it('should return database table metadata', async () => {
      const mockTableMetadata: TableMetadata[] = [
        {
          tableName: 'customers',
          columns: [
            { columnName: 'id', dataType: 'INTEGER', nullable: false, isPrimaryKey: true },
            { columnName: 'name', dataType: 'TEXT', nullable: false, isPrimaryKey: false },
            { columnName: 'email', dataType: 'TEXT', nullable: false, isPrimaryKey: false }
          ]
        },
        {
          tableName: 'products',
          columns: [
            { columnName: 'id', dataType: 'INTEGER', nullable: false, isPrimaryKey: true },
            { columnName: 'name', dataType: 'TEXT', nullable: false, isPrimaryKey: false },
            { columnName: 'price', dataType: 'DECIMAL', nullable: false, isPrimaryKey: false }
          ]
        }
      ];

      mockModel.getTableMetadata.mockResolvedValue(mockTableMetadata);

      const result = await service.getTableInfo();

      expect(mockModel.getTableMetadata).toHaveBeenCalled();
      expect(result).toEqual(mockTableMetadata);
    });

    it('should handle metadata retrieval failures', async () => {
      const metadataError = new Error('Failed to retrieve table metadata');
      mockModel.getTableMetadata.mockRejectedValue(metadataError);

      await expect(service.getTableInfo()).rejects.toThrow('Failed to retrieve table metadata');
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        'Failed to get table info:',
        metadataError
      );
    });

    it('should cache table metadata for performance', async () => {
      const mockTableMetadata: TableMetadata[] = [
        {
          tableName: 'customers',
          columns: [
            { columnName: 'id', dataType: 'INTEGER', nullable: false, isPrimaryKey: true }
          ]
        }
      ];

      mockModel.getTableMetadata.mockResolvedValue(mockTableMetadata);

      // First call
      const result1 = await service.getTableInfo();
      // Second call
      const result2 = await service.getTableInfo();

      expect(result1).toEqual(mockTableMetadata);
      expect(result2).toEqual(mockTableMetadata);

      // Should only call model once due to caching
      expect(mockModel.getTableMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck() - Public Method', () => {
    it('should return true when all components are healthy', async () => {
      service.isInitialized = true;

      mockEnv.FINANCIAL_DATABASE.executeQuery.mockResolvedValue({
        message: 'Query executed successfully',
        results: '[{"health": "ok"}]',
        status: 200,
        queryExecuted: 'SELECT 1 as health'
      });

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockEnv.FINANCIAL_DATABASE.executeQuery).toHaveBeenCalledWith({
        sqlQuery: 'SELECT 1 as health',
        format: 'json'
      });
    });

    it('should return false when database is not initialized', async () => {
      service.isInitialized = false;

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
      expect(mockEnv.logger.warn).toHaveBeenCalledWith('Health check failed: Database not initialized');
    });

    it('should return false when SmartSQL is unavailable', async () => {
      service.isInitialized = true;

      mockEnv.FINANCIAL_DATABASE.executeQuery.mockRejectedValue(
        new Error('SmartSQL service unavailable')
      );

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        'Health check failed:',
        expect.any(Error)
      );
    });

    it('should include detailed health information in logs', async () => {
      service.isInitialized = true;

      mockEnv.FINANCIAL_DATABASE.executeQuery.mockResolvedValue({
        message: 'Query executed successfully',
        results: '[{"health": "ok"}]',
        status: 200,
        queryExecuted: 'SELECT 1 as health'
      });

      await service.healthCheck();

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Health check completed',
        expect.objectContaining({
          databaseInitialized: true,
          smartSqlConnected: true,
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('Service-to-Service Communication', () => {
    it('should be accessible via environment bindings', () => {
      // Verify the service can be bound to env.DATABASE_MANAGER
      expect(service).toBeDefined();
      expect(typeof service.executeQuery).toBe('function');
      expect(typeof service.initializeDatabase).toBe('function');
      expect(typeof service.getTableInfo).toBe('function');
      expect(typeof service.healthCheck).toBe('function');
    });

    it('should support async service-to-service calls', async () => {
      service.isInitialized = true;

      mockController.orchestrateQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT COUNT(*) as count FROM customers',
        results: '[{"count": 50}]',
        format: 'json',
        rowCount: 1,
        executionTime: 75,
        sessionId: 'service-call-session'
      });

      // Simulate another service calling this one
      const result = await service.executeQuery(
        'How many customers do we have?',
        'service-call-session'
      );

      expect(result.success).toBe(true);
      expect(result.queryExecuted).toContain('COUNT(*)');
    });

    it('should handle concurrent service calls', async () => {
      service.isInitialized = true;

      mockController.orchestrateQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM customers',
        results: '[]',
        format: 'json',
        rowCount: 0,
        executionTime: 100,
        sessionId: 'concurrent-session'
      });

      // Simulate multiple concurrent calls
      const promises = Array.from({ length: 5 }, (_, i) =>
        service.executeQuery(`Query ${i}`, `session-${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(mockController.orchestrateQuery).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log all service operations for audit', async () => {
      service.isInitialized = true;

      mockController.orchestrateQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'SELECT * FROM products',
        results: '[]',
        format: 'json',
        rowCount: 0,
        executionTime: 120,
        sessionId: 'audit-session'
      });

      await service.executeQuery('Show me products', 'audit-session');

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Public executeQuery called',
        expect.objectContaining({
          naturalQuery: 'Show me products',
          sessionId: 'audit-session',
          timestamp: expect.any(String)
        })
      );

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Query executed successfully',
        expect.objectContaining({
          sessionId: 'audit-session',
          executionTime: 120
        })
      );
    });

    it('should handle and log unexpected errors', async () => {
      const unexpectedError = new Error('Unexpected service failure');
      mockController.orchestrateQuery.mockRejectedValue(unexpectedError);

      mockController.handleDatabaseError.mockReturnValue({
        success: false,
        error: 'Unexpected service failure',
        code: 500,
        timestamp: new Date().toISOString()
      });

      const result = await service.executeQuery('Test query', 'error-session');

      expect(result.success).toBe(false);
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        'Service operation failed:',
        expect.any(Error)
      );
    });

    it('should provide helpful error messages for common issues', async () => {
      // Test validation error
      await expect(service.executeQuery('', 'test-session'))
        .rejects.toThrow('Natural query cannot be empty');

      // Test initialization error
      service.isInitialized = false;
      mockController.initializeDatabase.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.executeQuery('Test', 'test-session'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('Integration with Background Tasks', () => {
    it('should use waitUntil for background processing', async () => {
      service.isInitialized = true;

      mockController.orchestrateQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'INSERT INTO audit_log VALUES (...)',
        results: '[]',
        format: 'json',
        rowCount: 1,
        executionTime: 50,
        sessionId: 'bg-session'
      });

      await service.executeQuery('Log this action', 'bg-session');

      // Should use ctx.waitUntil for background audit logging
      expect(mockCtx.waitUntil).toHaveBeenCalled();

      const backgroundTask = mockCtx.waitUntil.mock.calls[0][0];
      expect(backgroundTask).toBeInstanceOf(Promise);
    });
  });
});
