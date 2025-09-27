import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { insertMockData } from '../sql/financial-database';

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      success: false,
      error: 'Not implemented',
      message: 'This is a private service accessible only via environment bindings'
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async executeQuery(naturalQuery: string, sessionId: string, intent?: string) {
    try {
      const startTime = Date.now();

      // Ensure mock data exists on first query
      await this.ensureMockData();

      // Only generate SQL if intent is 'sql' or 'both'
      if (intent === 'image') {
        // Skip SQL generation for image-only requests
        return {
          success: true,
          queryExecuted: '',
          results: JSON.stringify([]),
          format: 'json' as const,
          rowCount: 0,
          executionTime: Date.now() - startTime,
          sessionId,
          skipped: true,
          reason: 'Image-only request'
        };
      }

      // Generate SQL based on natural language and execute against real database
      let sqlQuery = '';

      if (naturalQuery.toLowerCase().includes('customer')) {
        sqlQuery = 'SELECT id, name, email, join_date, total_spent FROM customers ORDER BY total_spent DESC LIMIT 10';
      } else if (naturalQuery.toLowerCase().includes('product')) {
        sqlQuery = 'SELECT id, name, category, price, launch_date FROM products ORDER BY price DESC LIMIT 10';
      } else if (naturalQuery.toLowerCase().includes('purchase') || naturalQuery.toLowerCase().includes('sales')) {
        sqlQuery = 'SELECT p.id, c.name as customer_name, pr.name as product_name, p.amount, p.purchase_date, p.quantity FROM purchases p JOIN customers c ON p.customer_id = c.id JOIN products pr ON p.product_id = pr.id ORDER BY p.purchase_date DESC LIMIT 10';
      } else if (naturalQuery.toLowerCase().includes('revenue') || naturalQuery.toLowerCase().includes('total')) {
        sqlQuery = 'SELECT SUM(amount) as total_revenue, COUNT(*) as total_sales, COUNT(DISTINCT customer_id) as unique_customers FROM purchases';
      } else {
        // Default to showing customers
        sqlQuery = 'SELECT id, name, email, total_spent FROM customers ORDER BY total_spent DESC LIMIT 5';
      }

      console.log('Executing SQL query:', sqlQuery);

      // Execute the actual SQL query against SmartSQL database
      const queryResult = await this.env.FINANCIAL_DATABASE.executeQuery({
        sqlQuery: sqlQuery,
        format: 'json'
      });

      console.log('SmartSQL result:', queryResult);

      if (queryResult.status !== 200) {
        throw new Error(queryResult.message || 'Database query failed');
      }

      // Parse the results from SmartSQL
      let actualResults = [];
      if (queryResult.results) {
        try {
          if (typeof queryResult.results === 'object' && 'jsonResults' in queryResult.results) {
            actualResults = JSON.parse((queryResult.results as any).jsonResults);
          } else if (typeof queryResult.results === 'string') {
            actualResults = JSON.parse(queryResult.results);
          } else {
            actualResults = queryResult.results;
          }
        } catch (parseError) {
          console.error('Failed to parse query results:', parseError);
          actualResults = [];
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        queryExecuted: sqlQuery,
        results: JSON.stringify(actualResults),
        format: 'json' as const,
        rowCount: actualResults.length,
        executionTime,
        sessionId
      };

    } catch (error: any) {
      console.error('Query execution failed:', error);
      return {
        success: false,
        error: `Query execution failed: ${error?.message || 'Unknown error'}`,
        sessionId,
        executionTime: 0
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private async ensureMockData(): Promise<void> {
    try {
      // First, ensure tables exist by creating them
      await this.createTablesIfNotExist();

      // Check if customers table has data
      const checkResult = await this.env.FINANCIAL_DATABASE.executeQuery({
        sqlQuery: 'SELECT COUNT(*) as count FROM customers',
        format: 'json'
      });

      let customerCount = 0;
      if (checkResult.status === 200 && checkResult.results) {
        const results = typeof checkResult.results === 'string'
          ? JSON.parse(checkResult.results)
          : checkResult.results;
        customerCount = results[0]?.count || 0;
      }

      // If no customers exist, insert mock data
      if (customerCount === 0) {
        console.log('No customers found, inserting mock data...');
        const mockDataStatements = await insertMockData();

        for (const statement of mockDataStatements) {
          await this.env.FINANCIAL_DATABASE.executeQuery({
            sqlQuery: statement,
            format: 'json'
          });
        }

        console.log('Mock data insertion completed');
      }
    } catch (error) {
      console.error('Failed to ensure mock data:', error);
      // Don't throw - let the query continue even if mock data fails
    }
  }

  private async createTablesIfNotExist(): Promise<void> {
    try {
      console.log('Creating database tables if they do not exist...');

      // Create customers table
      await this.env.FINANCIAL_DATABASE.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          total_spent DECIMAL(10,2) DEFAULT 0.00
        )`,
        format: 'json'
      });

      // Create products table
      await this.env.FINANCIAL_DATABASE.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          launch_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        format: 'json'
      });

      // Create purchases table
      await this.env.FINANCIAL_DATABASE.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          quantity INTEGER DEFAULT 1,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )`,
        format: 'json'
      });

      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Failed to create database tables:', error);
      // Don't throw - let the process continue
    }
  }
}