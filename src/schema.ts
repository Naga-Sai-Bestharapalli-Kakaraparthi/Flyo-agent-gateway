import { z } from 'zod';

export const TravelQuerySchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(5, 'Prompt too short')
      .max(2000, 'Prompt too long'),
    maxBudgetINR: z.number().positive().max(1_000_000).optional(),
  })
  .strict();

export type TravelQuery = z.infer<typeof TravelQuerySchema>;
