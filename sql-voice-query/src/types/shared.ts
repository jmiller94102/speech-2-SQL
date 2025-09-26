// Simplified shared types for demo deployment
export interface QueryResponse {
  success: boolean;
  transcription?: string;
  sql?: string;
  results?: any[];
  executionTime?: string;
  sessionId?: string;
  error?: string;
  imagePrompt?: string;
  generatedImageUrl?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    voiceProcessor: { status: string; responseTime: number };
    databaseManager: { status: string; responseTime: number };
  };
  timestamp: string;
}