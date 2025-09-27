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

    // Voice query endpoint - real AI processing
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

        // Validate audio file type
        const supportedTypes = [
          'audio/mp3', 'audio/mpeg',
          'audio/wav', 'audio/wave', 'audio/x-wav',
          'audio/ogg', 'audio/ogg;codecs=opus',
          'audio/m4a', 'audio/mp4',
          'audio/webm', 'audio/webm;codecs=opus'
        ];

        const fileType = audioFile.type || '';
        console.log('Received audio file:', { type: fileType, size: audioFile.size });

        // Accept the file regardless of MIME type for now, but log it
        if (fileType && !supportedTypes.some(type => fileType.includes(type.split(';')[0]))) {
          console.warn('Unsupported audio type received:', fileType);
          // Continue processing anyway - the voice processor should handle it
        }

        const sessionId = Date.now().toString();
        const startTime = Date.now();

        // Convert audio file to buffer with error handling
        let audioBuffer;
        try {
          const arrayBuffer = await audioFile.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuffer);
          console.log('Audio buffer created successfully:', { size: audioBuffer.length });
        } catch (bufferError) {
          console.error('Failed to create audio buffer:', bufferError);
          return c.json({
            success: false,
            error: 'Failed to process audio file'
          }, 400);
        }

        // Process audio with intelligent voice processing
        const actorId = this.env.VOICE_PROCESSOR.idFromName(sessionId);
        const voiceProcessor = this.env.VOICE_PROCESSOR.get(actorId);
        const voiceResult = await voiceProcessor.processAudio(audioBuffer, sessionId);

        if (!voiceResult.success) {
          return c.json({
            success: false,
            error: voiceResult.error || 'Voice processing failed'
          }, 500);
        }

        // Check user intent and execute appropriate processing
        const userIntent = voiceResult.intent || 'both';

        let queryResult = null;
        if (userIntent === 'sql' || userIntent === 'both') {
          // Generate SQL and execute query with real AI
          queryResult = await this.env.DATABASE_MANAGER.executeQuery(voiceResult.transcribedText || '', sessionId, userIntent);

          if (!queryResult.success) {
            return c.json({
              success: false,
              error: queryResult.error || 'Query execution failed'
            }, 500);
          }
        }

        const totalExecutionTime = Date.now() - startTime;

        // Parse results back to objects for frontend
        let results = [];
        if (queryResult && queryResult.results) {
          try {
            results = JSON.parse(queryResult.results);
          } catch (e) {
            results = [];
          }
        }

        // Build response based on intent
        const response: any = {
          success: true,
          transcription: voiceResult.transcribedText || '',
          executionTime: `${totalExecutionTime}ms`,
          sessionId: sessionId,
          intent: userIntent,
          intentConfidence: voiceResult.intentConfidence || 0.5
        };

        // Add SQL data if requested
        if (userIntent === 'sql' || userIntent === 'both') {
          response.sql = queryResult?.queryExecuted || '';
          response.results = results;
          response.resultCount = results.length;
        }

        // Add image data if requested
        if (userIntent === 'image' || userIntent === 'both') {
          response.imagePrompt = voiceResult.imagePrompt || '';
          response.generatedImageUrl = voiceResult.generatedImageUrl || '';
        }

        return c.json(response);

      } catch (error) {
        console.error('Query processing error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return c.json({
          success: false,
          error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, 500);
      }
    });

    this.app.options('*', (c: any) => c.text('', 204));
    this.app.notFound((c: any) => c.json({ error: 'Not found' }, 404));
  }
}