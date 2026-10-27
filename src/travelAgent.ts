// src/travelAgent.ts
import { TravelQuery } from './schema';
import { logger } from './logger';

export type TravelResult = { itinerary: string; status: 'SUCCESS' };
export type LlmFn = (input: TravelQuery) => Promise<TravelResult>;

// Point this to your Python service
const PYTHON_AI_URL = process.env.PYTHON_AI_URL ?? 'http://127.0.0.1:8000';

export const pythonAiAgent: LlmFn = async (input) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Python AI service responded with ${response.status}`);
    }

    const data = await response.json();
    return data as TravelResult;
  } catch (error) {
    logger.error({ err: error }, 'python_ai_service_failed');
    throw new Error('AI_ENGINE_UNAVAILABLE');
  }
};
