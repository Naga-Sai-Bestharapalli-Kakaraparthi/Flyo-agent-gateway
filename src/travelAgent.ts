import { TravelQuery } from './schema';

export type TravelResult = { itinerary: string; status: 'SUCCESS' };
export type LlmFn = (input: TravelQuery) => Promise<TravelResult>;

export const mockLlm: LlmFn = async (input) => ({
  itinerary: `3-Day Plan for: ${input.prompt}`,
  status: 'SUCCESS',
});
