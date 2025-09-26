/**
 * COMPREHENSIVE TEST SUITE for database-manager Model
 *
 * Testing Strategy: STRICT TDD RED -> GREEN -> REFACTOR
 *
 * TEST COVERAGE:
 * 1. SmartSQL database operations and schema creation
 * 2. Mock financial data generation (customers, products, purchases)
 * 3. Natural language query processing
 * 4. Query result formatting and validation
 * 5. Database security and access control
 * 6. Error handling for all failure scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  QueryResult,
  TableMetadata,
  DatabaseInitResult,
  MockDataConfig,
  QueryValidationResult,
  Customer,
  Product,
  Purchase
} from '../types/shared.js';

// Mock the SmartSQL environment
const mockSmartSQL = {
  executeQuery: vi.fn(),
  getMetadata: vi.fn(),
  updateMetadata: vi.fn(),
  getPiiData: vi.fn()
};

const mockEnv = {
  FINANCIAL_DATABASE: mockSmartSQL,
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
};

// Import the model class that we'll implement
// This will fail initially as the class doesn't exist yet
let DatabaseModel: any;

try {
  const modelModule = await import('./model.js');
  DatabaseModel = modelModule.DatabaseModel;
} catch (error) {
  // Expected to fail during RED phase
  DatabaseModel = class MockDatabaseModel {
    constructor(env: any) {}
    async executeNaturalQuery(query: string): Promise<QueryResult> { throw new Error('Not implemented'); }
    async generateMockData(): Promise<void> { throw new Error('Not implemented'); }
    async createTables(): Promise<void> { throw new Error('Not implemented'); }
    validateQuery(query: string): boolean { throw new Error('Not implemented'); }
    formatResults(data: any[]): QueryResult { throw new Error('Not implemented'); }
  };
}

describe('DatabaseModel', () => {
  let model: any;

  beforeEach(() => {
    vi.clearAllMocks();
    model = new DatabaseModel(mockEnv);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with SmartSQL environment binding', () => {
      expect(model).toBeDefined();
      expect(model.env).toBe(mockEnv);
      expect(model.env.FINANCIAL_DATABASE).toBe(mockSmartSQL);
    });

    it('should initialize with logger from environment', () => {
      expect(model.env.logger).toBeDefined();
      expect(typeof model.env.logger.info).toBe('function');
      expect(typeof model.env.logger.error).toBe('function');
    });
  });

  describe('createTables()', () => {
    it('should create all required tables using SmartSQL', async () => {
      mockSmartSQL.executeQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'CREATE TABLE IF NOT EXISTS customers...',
        results: '[]',
        status: 200
      });

      await model.createTables();

      // Should execute CREATE TABLE statements for customers, products, purchases
      expect(mockSmartSQL.executeQuery).toHaveBeenCalledTimes(3);

      // Verify specific table creation queries
      const calls = mockSmartSQL.executeQuery.mock.calls;
      expect(calls[0][0].sqlQuery).toContain('CREATE TABLE IF NOT EXISTS customers');
      expect(calls[1][0].sqlQuery).toContain('CREATE TABLE IF NOT EXISTS products');
      expect(calls[2][0].sqlQuery).toContain('CREATE TABLE IF NOT EXISTS purchases');
    });

    it('should handle table creation failures gracefully', async () => {
      mockSmartSQL.executeQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(model.createTables()).rejects.toThrow('Database connection failed');
      expect(mockEnv.logger.error).toHaveBeenCalledWith('Failed to create tables:', expect.any(Error));
    });

    it('should verify table schemas match financial-database.ts', async () => {
      mockSmartSQL.executeQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'CREATE TABLE...',
        results: '[]',
        status: 200
      });

      await model.createTables();

      const calls = mockSmartSQL.executeQuery.mock.calls;

      // Verify customers table schema
      expect(calls[0][0].sqlQuery).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(calls[0][0].sqlQuery).toContain('name TEXT NOT NULL');
      expect(calls[0][0].sqlQuery).toContain('email TEXT UNIQUE NOT NULL');
      expect(calls[0][0].sqlQuery).toContain('total_spent DECIMAL(10,2)');

      // Verify products table schema
      expect(calls[1][0].sqlQuery).toContain('category TEXT NOT NULL');
      expect(calls[1][0].sqlQuery).toContain('price DECIMAL(10,2) NOT NULL');

      // Verify purchases table with foreign keys
      expect(calls[2][0].sqlQuery).toContain('FOREIGN KEY (customer_id) REFERENCES customers(id)');
      expect(calls[2][0].sqlQuery).toContain('FOREIGN KEY (product_id) REFERENCES products(id)');
    });
  });

  describe('generateMockData()', () => {
    beforeEach(() => {
      mockSmartSQL.executeQuery.mockResolvedValue({
        success: true,
        queryExecuted: 'INSERT INTO...',
        results: '[]',
        status: 200
      });
    });

    it('should generate 50 customers with realistic data', async () => {
      await model.generateMockData();

      const customerInserts = mockSmartSQL.executeQuery.mock.calls
        .filter(call => call[0].sqlQuery?.includes('INSERT INTO customers'));

      expect(customerInserts).toHaveLength(50);

      // Verify customer data structure
      customerInserts.forEach(call => {
        expect(call[0].sqlQuery).toContain('INSERT INTO customers');
        expect(call[0].sqlQuery).toMatch(/VALUES.*@.*\./); // Email format
      });
    });

    it('should generate 20 products with different categories', async () => {
      await model.generateMockData();

      const productInserts = mockSmartSQL.executeQuery.mock.calls
        .filter(call => call[0].sqlQuery?.includes('INSERT INTO products'));

      expect(productInserts).toHaveLength(20);

      // Verify products have categories and prices
      productInserts.forEach(call => {
        expect(call[0].sqlQuery).toContain('INSERT INTO products');
        expect(call[0].sqlQuery).toMatch(/\d+\.\d{2}/); // Price format
      });
    });

    it('should generate 200 purchases linking customers and products', async () => {
      await model.generateMockData();

      const purchaseInserts = mockSmartSQL.executeQuery.mock.calls
        .filter(call => call[0].sqlQuery?.includes('INSERT INTO purchases'));

      expect(purchaseInserts).toHaveLength(200);

      // Verify purchases reference valid customer and product IDs
      purchaseInserts.forEach(call => {
        expect(call[0].sqlQuery).toContain('INSERT INTO purchases');
        expect(call[0].sqlQuery).toMatch(/customer_id.*product_id/);
      });
    });

    it('should handle mock data generation failures', async () => {
      mockSmartSQL.executeQuery.mockRejectedValue(new Error('Insert failed'));

      await expect(model.generateMockData()).rejects.toThrow('Insert failed');
      expect(mockEnv.logger.error).toHaveBeenCalledWith('Failed to generate mock data:', expect.any(Error));
    });

    it('should generate data with valid relationships and constraints', async () => {
      await model.generateMockData();

      // Verify customer IDs are within range 1-50
      const purchaseInserts = mockSmartSQL.executeQuery.mock.calls
        .filter(call => call[0].sqlQuery?.includes('INSERT INTO purchases'));

      purchaseInserts.forEach(call => {
        // Extract customer_id and product_id from query
        const query = call[0].sqlQuery;
        expect(query).toMatch(/customer_id.*[1-9]|[1-4][0-9]|50/); // 1-50
        expect(query).toMatch(/product_id.*[1-9]|1[0-9]|20/); // 1-20
      });
    });
  });

  describe('executeNaturalQuery()', () => {
    const mockSessionId = 'test-session-123';

    it('should execute natural language queries via SmartSQL', async () => {
      const mockResponse = {
        message: 'Query executed successfully',
        results: '[{"id": 1, "name": "John Doe", "email": "john@example.com"}]',
        status: 200,
        queryExecuted: 'SELECT * FROM customers WHERE name LIKE "%John%"',
        aiReasoning: 'User asked for customers named John'
      };

      mockSmartSQL.executeQuery.mockResolvedValue(mockResponse);

      const result = await model.executeNaturalQuery('Find customers named John');

      expect(mockSmartSQL.executeQuery).toHaveBeenCalledWith({
        textQuery: 'Find customers named John',
        format: 'json'
      });

      expect(result).toEqual({
        success: true,
        queryExecuted: 'SELECT * FROM customers WHERE name LIKE "%John%"',
        results: '[{"id": 1, "name": "John Doe", "email": "john@example.com"}]',
        format: 'json',
        rowCount: 1,
        executionTime: expect.any(Number),
        sessionId: mockSessionId,
        aiReasoning: 'User asked for customers named John'
      });
    });

    it('should handle SmartSQL service failures with retries', async () => {
      mockSmartSQL.executeQuery
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({
          message: 'Query executed successfully',
          results: '[]',
          status: 200,
          queryExecuted: 'SELECT * FROM customers'
        });

      const result = await model.executeNaturalQuery('Show all customers');

      expect(mockSmartSQL.executeQuery).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should validate query safety before execution', async () => {
      const dangerousQueries = [
        'DROP TABLE customers',
        'DELETE FROM customers',
        'UPDATE customers SET name = "hacked"',
        'ALTER TABLE customers DROP COLUMN email'
      ];

      for (const query of dangerousQueries) {
        await expect(model.executeNaturalQuery(query))
          .rejects.toThrow('Unsafe query detected');
      }
    });

    it('should return properly formatted QueryResult', async () => {
      mockSmartSQL.executeQuery.mockResolvedValue({
        message: 'Success',
        results: '[{"id": 1}, {"id": 2}]',
        status: 200,
        queryExecuted: 'SELECT id FROM customers',
        aiReasoning: 'Getting customer IDs'
      });

      const result = await model.executeNaturalQuery('Get customer IDs');

      expect(result).toMatchObject({
        success: true,
        queryExecuted: expect.any(String),
        results: expect.any(String),
        format: 'json',
        rowCount: expect.any(Number),
        executionTime: expect.any(Number),
        sessionId: expect.any(String),
        aiReasoning: expect.any(String)
      });
    });

    it('should handle CSV format requests', async () => {
      mockSmartSQL.executeQuery.mockResolvedValue({
        message: 'Success',
        results: 'id,name\n1,John\n2,Jane',
        status: 200,
        queryExecuted: 'SELECT id, name FROM customers'
      });

      const result = await model.executeNaturalQuery('Get customer names as CSV', 'csv');

      expect(mockSmartSQL.executeQuery).toHaveBeenCalledWith({
        textQuery: 'Get customer names as CSV',
        format: 'csv'
      });

      expect(result.format).toBe('csv');
      expect(result.results).toBe('id,name\n1,John\n2,Jane');
    });
  });

  describe('validateQuery()', () => {
    it('should allow safe SELECT queries', () => {
      const safeQueries = [
        'SELECT * FROM customers',
        'SELECT name, email FROM customers WHERE id = 1',
        'SELECT COUNT(*) FROM products WHERE category = "electronics"'
      ];

      safeQueries.forEach(query => {
        expect(model.validateQuery(query)).toBe(true);
      });
    });

    it('should reject dangerous operations', () => {
      const dangerousQueries = [
        'DROP TABLE customers',
        'DELETE FROM customers',
        'UPDATE customers SET name = "hacked"',
        'ALTER TABLE customers DROP COLUMN email',
        'TRUNCATE TABLE products',
        'INSERT INTO customers (name) VALUES ("unauthorized")'
      ];

      dangerousQueries.forEach(query => {
        expect(model.validateQuery(query)).toBe(false);
      });
    });

    it('should reject DELETE without WHERE clause', () => {
      expect(model.validateQuery('DELETE FROM customers')).toBe(false);
      expect(model.validateQuery('DELETE FROM customers WHERE id = 1')).toBe(false); // Still dangerous
    });

    it('should validate query syntax', () => {
      const invalidQueries = [
        'SELEC * FROM customers', // Typo
        'SELECT * FORM customers', // Typo
        'SELECT * FROM', // Incomplete
        ''  // Empty
      ];

      invalidQueries.forEach(query => {
        expect(model.validateQuery(query)).toBe(false);
      });
    });
  });

  describe('formatResults()', () => {
    it('should format raw data into QueryResult structure', () => {
      const rawData = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
      ];

      const result = model.formatResults(rawData);

      expect(result).toMatchObject({
        success: true,
        results: expect.any(String),
        format: 'json',
        rowCount: 2,
        executionTime: expect.any(Number)
      });

      const parsedResults = JSON.parse(result.results);
      expect(parsedResults).toEqual(rawData);
    });

    it('should handle empty result sets', () => {
      const result = model.formatResults([]);

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
      expect(JSON.parse(result.results)).toEqual([]);
    });

    it('should include metadata for complex results', () => {
      const rawData = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

      const result = model.formatResults(rawData);

      expect(result.metadata).toMatchObject({
        totalRows: 100,
        columns: ['id']
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      mockSmartSQL.executeQuery.mockRejectedValue(new Error('Connection timeout'));

      await expect(model.executeNaturalQuery('SELECT * FROM customers'))
        .rejects.toThrow('Connection timeout');

      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        'Database query failed:',
        expect.any(Error)
      );
    });

    it('should handle malformed SmartSQL responses', async () => {
      mockSmartSQL.executeQuery.mockResolvedValue({
        // Missing required fields
        message: 'Success'
      });

      const result = await model.executeNaturalQuery('SELECT * FROM customers');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response from SmartSQL');
    });

    it('should handle query timeout scenarios', async () => {
      mockSmartSQL.executeQuery.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 1000)
        )
      );

      await expect(model.executeNaturalQuery('SELECT * FROM customers'))
        .rejects.toThrow('Query timeout');
    });
  });

  describe('Integration with SmartSQL Features', () => {
    it('should use SmartSQL metadata for query optimization', async () => {
      const mockMetadata = {
        tables: [
          {
            tableName: 'customers',
            columns: [
              { columnName: 'id', dataType: 'INTEGER', isPrimaryKey: true },
              { columnName: 'name', dataType: 'TEXT', sampleData: 'John Doe' }
            ]
          }
        ]
      };

      mockSmartSQL.getMetadata.mockResolvedValue(mockMetadata);

      const metadata = await model.getTableMetadata();

      expect(mockSmartSQL.getMetadata).toHaveBeenCalled();
      expect(metadata).toEqual(mockMetadata.tables);
    });

    it('should handle PII detection in query results', async () => {
      mockSmartSQL.executeQuery.mockResolvedValue({
        message: 'Success',
        results: '[{"email": "john@example.com", "phone": "555-1234"}]',
        status: 200,
        queryExecuted: 'SELECT email, phone FROM customers'
      });

      const result = await model.executeNaturalQuery('Get customer contact info');

      // Should log PII detection warning
      expect(mockEnv.logger.warn).toHaveBeenCalledWith(
        'Query results may contain PII data',
        expect.any(Object)
      );
    });
  });
});