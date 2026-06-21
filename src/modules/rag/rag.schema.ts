import { z } from 'zod';

export const ingestBodySchema = z.object({
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  source: z.string().optional()
});

export const searchBodySchema = z.object({
  query: z.string().min(1, 'query is required'),
  topK: z.number().int().positive().max(20).optional()
});
