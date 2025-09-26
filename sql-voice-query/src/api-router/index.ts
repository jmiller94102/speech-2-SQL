import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';

export default class extends Service<Env> {
  private app: Hono;

  constructor(state: any, env: Env) {
    super(state, env);

    this.app = new Hono();

    // CORS
    this.app.use('*', cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }));

    this.app.use('*', logger());
    this.setupRoutes();
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request, this.env);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (c: any) => {
      return c.json({
        status: 'healthy',
        components: {
          voiceProcessor: { status: 'healthy', responseTime: 45 },
          databaseManager: { status: 'healthy', responseTime: 23 }
        },
        timestamp: new Date().toISOString()
      });
    });

    // Voice query endpoint - simplified for demo
    this.app.post('/query', async (c: any) => {
      try {
        const body = await c.req.parseBody();
        const audioFile = body.audio;

        if (!audioFile) {
          return c.json({
            success: false,
            error: 'Audio file required'
          }, 400);
        }

        // Mock response for demo
        return c.json({
          success: true,
          transcription: "Show me all customers",
          sql: "SELECT * FROM customers LIMIT 10",
          results: [
            { id: 1, name: "John Doe", email: "john@example.com", total_spent: 1250.00 },
            { id: 2, name: "Jane Smith", email: "jane@example.com", total_spent: 890.50 }
          ],
          executionTime: "125ms",
          sessionId: Date.now().toString()
        });

      } catch (error) {
        return c.json({
          success: false,
          error: 'Processing failed'
        }, 500);
      }
    });

    this.app.options('*', (c: any) => c.text('', 204));
    this.app.notFound((c: any) => c.json({ error: 'Not found' }, 404));
  }
}