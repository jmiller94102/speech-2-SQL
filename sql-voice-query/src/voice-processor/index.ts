import { Actor, ActorState } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';

export class VoiceProcessor extends Actor<Env> {
  constructor(state: ActorState, env: Env) {
    super(state, env);
  }

  async processAudio(audioBuffer: Buffer, sessionId: string) {
    // Mock implementation for demo
    return {
      success: true,
      transcribedText: "Show me all customers",
      naturalQuery: "Show me all customers",
      confidence: 0.95,
      sessionId,
      processingTime: 1500
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

export default VoiceProcessor;